import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import { createUser } from '../users/service'
import { createParty } from '../parties/service'
import { createItem, getItemById } from '../items/service'
import { getBalance } from '../ledger/service'
import { getItemStock, getLotStock } from '../stock/service'
import { createPurchase, getPurchase, listPurchases, returnPurchase } from './service'

type Db = ReturnType<typeof createTestDb>

function setup(): { db: Db; userId: number; supplierId: number } {
  const db = createTestDb()
  const user = createUser(db, { name: 'Mgr', username: 'mgr', pin: '1234', role: 'manager' }) as unknown as { id: number }
  const sup = createParty(db, { type: 'supplier', name: 'Hamid Traders' })
  if (!sup.ok) throw new Error(sup.error.message)
  return { db, userId: user.id, supplierId: sup.data.id }
}

function item(db: Db, extra: Partial<Parameters<typeof createItem>[1]> = {}): number {
  const res = createItem(db, {
    name: `Item ${Math.random()}`,
    baseUnit: 'tablet',
    salePrice: 500,
    costPrice: 100,
    units: [{ name: 'Box', factor: 100 }],
    ...extra
  })
  if (!res.ok) throw new Error(res.error.message)
  return res.data.id
}

function counts(db: Db): Record<string, number> {
  const n = (t: string): number => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n
  return {
    purchases: n('purchases'), lines: n('purchase_lines'), movements: n('stock_movements'),
    lots: n('stock_lots'), ledger: n('party_ledger'), audit: n('audit_log')
  }
}

describe('createPurchase', () => {
  it('credit purchase: stock, cache, supplier balance and cost update; totals recomputed', () => {
    const { db, userId, supplierId } = setup()
    const a = item(db)
    const b = item(db, { units: [] })
    const res = createPurchase(db, {
      supplierId, billNo: ' B-1 ',
      lines: [
        { itemId: a, unitName: 'Box', qty: 3, unitCost: 5000 }, // 300 tablets, 50.00/box
        { itemId: b, qty: 10, unitCost: 250 }
      ],
      discount: 500
    }, userId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.subtotal).toBe(15000 + 2500)
    expect(res.data.total).toBe(17000)
    expect(res.data.billNo).toBe('B-1')
    expect(getItemStock(db, a)).toBe(300)
    expect(getItemById(db, a)!.stockCache).toBe(300)
    expect(getItemById(db, b)!.stockCache).toBe(10)
    expect(getBalance(db, supplierId)).toBe(-17000)
    expect(getItemById(db, a)!.costPrice).toBe(50) // 5000 / 100
    expect(getItemById(db, b)!.costPrice).toBe(250)
    expect(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'purchase_created'").get()).toEqual({ n: 1 })
  })

  it('converts pack qty to base units and rounds cost per base unit half-up', () => {
    const { db, userId, supplierId } = setup()
    const a = item(db, { units: [{ name: 'Strip', factor: 3 }] })
    const res = createPurchase(db, { supplierId, lines: [{ itemId: a, unitName: 'strip', qty: 2, unitCost: 1000 }] }, userId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.lines[0]).toMatchObject({ unitName: 'Strip', unitFactor: 3, qty: 2, qtyBase: 6, lineTotal: 2000 })
    expect(getItemStock(db, a)).toBe(6)
    expect(getItemById(db, a)!.costPrice).toBe(333) // 1000/3 = 333.33
    const c = item(db, { units: [{ name: 'Pair', factor: 2 }] })
    createPurchase(db, { supplierId, lines: [{ itemId: c, unitName: 'Pair', qty: 1, unitCost: 101 }] }, userId)
    expect(getItemById(db, c)!.costPrice).toBe(51) // 50.5 -> 51
  })

  it('cash purchase nets to zero; partial payment leaves the rest owed', () => {
    const { db, userId, supplierId } = setup()
    const a = item(db)
    createPurchase(db, { supplierId, lines: [{ itemId: a, qty: 10, unitCost: 100 }], paid: 1000 }, userId)
    expect(getBalance(db, supplierId)).toBe(0)
    const res = createPurchase(db, { supplierId, lines: [{ itemId: a, qty: 10, unitCost: 100 }], paid: 400 }, userId)
    expect(res.ok && res.data.paid).toBe(400)
    expect(getBalance(db, supplierId)).toBe(-600)
    const types = db.prepare('SELECT type FROM party_ledger ORDER BY id').all() as Array<{ type: string }>
    expect(types.map((t) => t.type)).toEqual(['purchase', 'payment_out', 'purchase', 'payment_out'])
  })

  it('lot items need lot no + expiry, create a lot, and reuse the same lot', () => {
    const { db, userId, supplierId } = setup()
    const a = item(db, { trackLots: true })
    expect(createPurchase(db, { supplierId, lines: [{ itemId: a, qty: 10, unitCost: 100 }] }, userId))
      .toMatchObject({ ok: false, error: { code: 'LOT_REQUIRED' } })
    expect(createPurchase(db, { supplierId, lines: [{ itemId: a, qty: 10, unitCost: 100, lotNo: 'L1' }] }, userId))
      .toMatchObject({ ok: false, error: { code: 'EXPIRY_REQUIRED' } })
    expect(createPurchase(db, { supplierId, lines: [{ itemId: a, qty: 10, unitCost: 100, lotNo: 'L1', expiryDate: '2027-02-30' }] }, userId))
      .toMatchObject({ ok: false, error: { code: 'INVALID_DATE' } })
    expect(counts(db).lots).toBe(0)

    const r1 = createPurchase(db, { supplierId, lines: [{ itemId: a, unitName: 'Box', qty: 1, unitCost: 10000, lotNo: 'L1', expiryDate: '2027-06-30' }] }, userId)
    expect(r1.ok).toBe(true)
    createPurchase(db, { supplierId, lines: [{ itemId: a, qty: 5, unitCost: 100, lotNo: 'L1', expiryDate: '2027-06-30' }] }, userId)
    const lots = db.prepare('SELECT * FROM stock_lots').all() as Array<{ id: number; lot_no: string; expiry_date: string; cost_price: number }>
    expect(lots).toHaveLength(1)
    expect(lots[0]).toMatchObject({ lot_no: 'L1', expiry_date: '2027-06-30', cost_price: 100 })
    expect(getLotStock(db, lots[0].id)).toBe(105)
    expect(getItemStock(db, a)).toBe(105)

    expect(createPurchase(db, { supplierId, lines: [{ itemId: a, qty: 1, unitCost: 100, lotNo: 'L1', expiryDate: '2028-01-01' }] }, userId))
      .toMatchObject({ ok: false, error: { code: 'LOT_EXPIRY_MISMATCH' } })
  })

  it('rolls back everything when a later line is bad', () => {
    const { db, userId, supplierId } = setup()
    const a = item(db)
    const lotItem = item(db, { trackLots: true })
    const before = counts(db)
    const res = createPurchase(db, {
      supplierId, paid: 100,
      lines: [
        { itemId: a, qty: 10, unitCost: 100 },
        { itemId: lotItem, qty: 5, unitCost: 100 } // missing lot -> fails after line 1
      ]
    }, userId)
    expect(res).toMatchObject({ ok: false, error: { code: 'LOT_REQUIRED' } })
    expect(counts(db)).toEqual(before)
    expect(getItemById(db, a)!.stockCache).toBe(0)
    expect(getItemById(db, a)!.costPrice).toBe(100)

    // failure that only appears mid-transaction (lot expiry clash on 2nd line of same bill)
    createPurchase(db, { supplierId, lines: [{ itemId: lotItem, qty: 1, unitCost: 100, lotNo: 'X', expiryDate: '2027-01-01' }] }, userId)
    const before2 = counts(db)
    const res2 = createPurchase(db, {
      supplierId,
      lines: [
        { itemId: a, qty: 10, unitCost: 100 },
        { itemId: lotItem, qty: 1, unitCost: 100, lotNo: 'X', expiryDate: '2029-01-01' }
      ]
    }, userId)
    expect(res2).toMatchObject({ ok: false, error: { code: 'LOT_EXPIRY_MISMATCH' } })
    expect(counts(db)).toEqual(before2)
    expect(getItemStock(db, a)).toBe(0)
    expect(getBalance(db, supplierId)).toBe(-100)
  })

  it('rejects bad suppliers, qty, units, discount, payment, date and untracked items', () => {
    const { db, userId, supplierId } = setup()
    const a = item(db)
    const cust = createParty(db, { type: 'customer', name: 'Ali' })
    const line = { itemId: a, qty: 1, unitCost: 100 }
    const bad = (input: Parameters<typeof createPurchase>[1]): string | undefined => {
      const r = createPurchase(db, input, userId)
      return r.ok ? undefined : r.error.code
    }
    expect(bad({ supplierId: 999, lines: [line] })).toBe('PARTY_NOT_FOUND')
    expect(bad({ supplierId: cust.ok ? cust.data.id : 0, lines: [line] })).toBe('WRONG_PARTY_TYPE')
    expect(bad({ supplierId, lines: [] })).toBe('NO_LINES')
    expect(bad({ supplierId, lines: [{ ...line, qty: 0 }] })).toBe('INVALID_QTY')
    expect(bad({ supplierId, lines: [{ ...line, qty: 1.5 }] })).toBe('INVALID_QTY')
    expect(bad({ supplierId, lines: [{ ...line, unitCost: -1 }] })).toBe('INVALID_PRICE')
    expect(bad({ supplierId, lines: [{ ...line, unitName: 'Carton' }] })).toBe('UNIT_NOT_FOUND')
    expect(bad({ supplierId, lines: [{ ...line, itemId: 999 }] })).toBe('ITEM_NOT_FOUND')
    expect(bad({ supplierId, lines: [line], discount: 101 })).toBe('INVALID_DISCOUNT')
    expect(bad({ supplierId, lines: [line], paid: 101 })).toBe('INVALID_PAYMENT')
    expect(bad({ supplierId, lines: [line], date: '2999-01-01' })).toBe('INVALID_DATE')
    expect(bad({ supplierId, lines: [line], date: 'yesterday' })).toBe('INVALID_DATE')
    const svc = item(db, { trackStock: false })
    expect(bad({ supplierId, lines: [{ ...line, itemId: svc }] })).toBe('ITEM_NOT_STOCKED')
    db.prepare('UPDATE parties SET active = 0 WHERE id = ?').run(supplierId)
    expect(bad({ supplierId, lines: [line] })).toBe('PARTY_INACTIVE')
    expect(counts(db).purchases).toBe(0)
  })

  it('lists and filters purchases', () => {
    const { db, userId, supplierId } = setup()
    const a = item(db)
    createPurchase(db, { supplierId, billNo: 'AB-1', date: '2026-01-05', lines: [{ itemId: a, qty: 1, unitCost: 100 }] }, userId)
    createPurchase(db, { supplierId, billNo: 'ZZ-9', date: '2026-02-05', lines: [{ itemId: a, qty: 1, unitCost: 100 }] }, userId)
    expect(listPurchases(db, {}).total).toBe(2)
    expect(listPurchases(db, { query: 'zz' }).purchases.map((p) => p.billNo)).toEqual(['ZZ-9'])
    expect(listPurchases(db, { from: '2026-02-01' }).total).toBe(1)
    expect(listPurchases(db, { query: '%' }).total).toBe(0)
    expect(listPurchases(db, { supplierId }).purchases[0].supplierName).toBe('Hamid Traders')
  })
})

describe('returnPurchase', () => {
  function bought(trackLots = false): { db: Db; userId: number; supplierId: number; itemId: number; purchaseId: number; lineId: number } {
    const { db, userId, supplierId } = setup()
    const itemId = item(db, { trackLots })
    const res = createPurchase(db, {
      supplierId, paid: 0,
      lines: [{ itemId, qty: 10, unitCost: 333, ...(trackLots ? { lotNo: 'L1', expiryDate: '2027-01-01' } : {}) }]
    }, userId)
    if (!res.ok) throw new Error(res.error.message)
    return { db, userId, supplierId, itemId, purchaseId: res.data.id, lineId: res.data.lines[0].id }
  }

  it('reduces stock, lot qty and supplier balance', () => {
    const { db, userId, supplierId, itemId, purchaseId, lineId } = bought(true)
    expect(getBalance(db, supplierId)).toBe(-3330)
    const res = returnPurchase(db, { purchaseId, lines: [{ purchaseLineId: lineId, qtyBase: 4 }] }, userId)
    expect(res).toMatchObject({ ok: true, data: { total: 1332 } })
    expect(getItemStock(db, itemId)).toBe(6)
    expect(getItemById(db, itemId)!.stockCache).toBe(6)
    const lot = db.prepare('SELECT id FROM stock_lots').get() as { id: number }
    expect(getLotStock(db, lot.id)).toBe(6)
    expect(getBalance(db, supplierId)).toBe(-3330 + 1332)
    const mv = db.prepare("SELECT qty, lot_id FROM stock_movements WHERE type = 'purchase_return'").get() as { qty: number; lot_id: number }
    expect(mv).toEqual({ qty: -4, lot_id: lot.id })
    const detail = getPurchase(db, purchaseId)!
    expect(detail.returnedTotal).toBe(1332)
    expect(detail.lines[0].returnedBase).toBe(4)
    expect(detail.returns).toHaveLength(1)
  })

  it('cannot return more than purchased minus already returned; full returns refund exactly the bill', () => {
    const { db, userId, supplierId, purchaseId, lineId } = bought()
    const ret = (q: number): ReturnType<typeof returnPurchase> =>
      returnPurchase(db, { purchaseId, lines: [{ purchaseLineId: lineId, qtyBase: q }] }, userId)
    expect(ret(11)).toMatchObject({ ok: false, error: { code: 'RETURN_TOO_MUCH' } })
    expect(ret(3).ok).toBe(true)
    expect(ret(8)).toMatchObject({ ok: false, error: { code: 'RETURN_TOO_MUCH' } })
    expect(ret(3).ok).toBe(true)
    expect(ret(4).ok).toBe(true)
    expect(ret(1)).toMatchObject({ ok: false, error: { code: 'RETURN_TOO_MUCH' } })
    expect(getBalance(db, supplierId)).toBe(0) // exactly cancelled, no rounding drift
    expect(getPurchase(db, purchaseId)!.returnedTotal).toBe(3330)
  })

  it('cannot make stock or lot negative (already sold) and saves nothing', () => {
    const { db, userId, supplierId, itemId, purchaseId, lineId } = bought(true)
    db.prepare("INSERT INTO stock_movements (item_id, lot_id, qty, type, created_at) VALUES (?, (SELECT id FROM stock_lots), -8, 'sale', '2026-01-01 00:00:00')").run(itemId)
    db.prepare('UPDATE items SET stock_cache = stock_cache - 8 WHERE id = ?').run(itemId)
    const before = counts(db)
    const res = returnPurchase(db, { purchaseId, lines: [{ purchaseLineId: lineId, qtyBase: 3 }] }, userId)
    expect(res).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_STOCK' } })
    expect(counts(db)).toEqual(before)
    expect(db.prepare('SELECT COUNT(*) AS n FROM purchase_returns').get()).toEqual({ n: 0 })
    expect(getBalance(db, supplierId)).toBe(-3330)
    expect(returnPurchase(db, { purchaseId, lines: [{ purchaseLineId: lineId, qtyBase: 2 }] }, userId).ok).toBe(true)
  })

  it('rolls back all lines when one line is bad, and rejects foreign lines / duplicates / missing purchase', () => {
    const { db, userId, supplierId, itemId, purchaseId, lineId } = bought()
    const other = createPurchase(db, { supplierId, lines: [{ itemId, qty: 5, unitCost: 100 }] }, userId)
    if (!other.ok) throw new Error('setup')
    const before = counts(db)
    expect(returnPurchase(db, { purchaseId, lines: [{ purchaseLineId: lineId, qtyBase: 2 }, { purchaseLineId: lineId, qtyBase: 1 }] }, userId))
      .toMatchObject({ ok: false, error: { code: 'DUPLICATE_LINE' } })
    expect(returnPurchase(db, { purchaseId, lines: [{ purchaseLineId: other.data.lines[0].id, qtyBase: 1 }] }, userId))
      .toMatchObject({ ok: false, error: { code: 'LINE_NOT_FOUND' } })
    expect(returnPurchase(db, { purchaseId, lines: [{ purchaseLineId: lineId, qtyBase: 2 }, { purchaseLineId: 9999, qtyBase: 1 }] }, userId))
      .toMatchObject({ ok: false, error: { code: 'LINE_NOT_FOUND' } })
    expect(returnPurchase(db, { purchaseId: 999, lines: [{ purchaseLineId: lineId, qtyBase: 1 }] }, userId))
      .toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(counts(db)).toEqual(before)
    expect(getItemStock(db, itemId)).toBe(15)
  })
})
