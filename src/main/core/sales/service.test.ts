import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import { createUser } from '../users/service'
import { createParty, updateParty } from '../parties/service'
import { createItem } from '../items/service'
import { createPurchase } from '../purchases/service'
import { getBalance } from '../ledger/service'
import { getItemStock, getLotStock } from '../stock/service'
import { setSetting } from '../settings/service'
import { openShift } from '../cash/service'
import type { MainModule } from '../../modules/types'
import { completeSale, discardHeld, getSale, holdSale, listSales } from './service'

type Db = ReturnType<typeof createTestDb>

interface Ctx { db: Db; userId: number; supplierId: number; customerId: number }

function setup(): Ctx {
  const db = createTestDb()
  const user = createUser(db, { name: 'Cash', username: 'cash', pin: '1234', role: 'cashier' }) as unknown as { id: number }
  openShift(db, { openingCash: 0 }, user.id)
  const sup = createParty(db, { type: 'supplier', name: 'Hamid' })
  const cus = createParty(db, { type: 'customer', name: 'Ali' })
  if (!sup.ok || !cus.ok) throw new Error('party')
  return { db, userId: user.id, supplierId: sup.data.id, customerId: cus.data.id }
}

let n = 0
function item(db: Db, extra: Partial<Parameters<typeof createItem>[1]> = {}): number {
  const res = createItem(db, {
    name: `Item ${++n}`, baseUnit: 'tablet', salePrice: 500, costPrice: 300,
    units: [{ name: 'Box', factor: 10, salePrice: 4500 }, { name: 'Strip', factor: 5 }],
    openingStock: { qty: 1000 },
    ...extra
  })
  if (!res.ok) throw new Error(res.error.message)
  return res.data.id
}

function unitId(db: Db, itemId: number, name: string): number {
  return (db.prepare('SELECT id FROM item_units WHERE item_id = ? AND name = ?').get(itemId, name) as { id: number }).id
}

function counts(db: Db): Record<string, number> {
  const c = (t: string): number => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n
  return { sales: c('sales'), lines: c('sale_lines'), mv: c('stock_movements'), ledger: c('party_ledger'), audit: c('audit_log') }
}

function nextNo(db: Db): string | undefined {
  return (db.prepare("SELECT value FROM settings WHERE key = 'next_invoice_no'").get() as { value: string } | undefined)?.value
}

beforeEach(() => { n = 0 })

describe('completeSale totals', () => {
  it('prices come from the DB; pack override and base x factor; change due', () => {
    const { db, userId } = setup()
    const a = item(db)
    const res = completeSale(db, {
      lines: [
        { itemId: a, qty: 3 }, // 3 x 500
        { itemId: a, unitId: unitId(db, a, 'Box'), qty: 2 }, // pack override 4500
        { itemId: a, unitId: unitId(db, a, 'Strip'), qty: 1 } // 5 x 500 = 2500
      ],
      paidCash: 20000, paidCredit: 0
    }, userId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const s = res.data.sale
    expect(s.subtotal).toBe(1500 + 9000 + 2500)
    expect(s.total).toBe(13000)
    expect(s.paidCash).toBe(13000)
    expect(res.data.changeDue).toBe(7000)
    expect(s.invoiceNo).toBe('000001')
    expect(s.lines.map((l) => [l.unitName, l.unitFactor, l.qtyBase, l.unitPrice, l.itemName])).toEqual([
      ['tablet', 1, 3, 500, 'Item 1'], ['Box', 10, 20, 4500, 'Item 1'], ['Strip', 5, 5, 2500, 'Item 1']
    ])
    expect(getItemStock(db, a)).toBe(1000 - 28)
  })

  it('line + percent + bill discounts; net totals add up to total', () => {
    const { db, userId } = setup()
    const a = item(db)
    const b = item(db, { salePrice: 333 })
    const res = completeSale(db, {
      lines: [
        { itemId: a, qty: 3, discount: 100 }, // 1500 - 100 = 1400
        { itemId: b, qty: 7, discountBp: 250 } // 2331, 2.5% = 58.275 -> 58 => 2273
      ],
      billDiscountBp: 1000, // 10% of 3673 = 367.3 -> 367
      paidCash: 100000, paidCredit: 0
    }, userId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const s = res.data.sale
    expect(s.subtotal).toBe(1500 + 2331)
    expect(s.billDiscount).toBe(367)
    expect(s.discount).toBe(100 + 58 + 367)
    expect(s.total).toBe(3831 - 525)
    expect(s.lines.reduce((x, l) => x + l.netTotal, 0)).toBe(s.total)
    expect(s.lines[1].discountBp).toBe(250)
  })

  it('rejects discounts bigger than the amount and bad quantities', () => {
    const { db, userId } = setup()
    const a = item(db)
    const pay = { paidCash: 1000000, paidCredit: 0 }
    expect(completeSale(db, { lines: [{ itemId: a, qty: 1, discount: 501 }], ...pay }, userId)).toMatchObject({ ok: false, error: { code: 'INVALID_DISCOUNT' } })
    expect(completeSale(db, { lines: [{ itemId: a, qty: 1 }], billDiscount: 501, ...pay }, userId)).toMatchObject({ ok: false, error: { code: 'INVALID_DISCOUNT' } })
    expect(completeSale(db, { lines: [{ itemId: a, qty: 0 }], ...pay }, userId)).toMatchObject({ ok: false, error: { code: 'INVALID_QTY' } })
    expect(completeSale(db, { lines: [{ itemId: a, qty: 1, unitId: 9999 }], ...pay }, userId)).toMatchObject({ ok: false, error: { code: 'UNIT_NOT_FOUND' } })
    expect(completeSale(db, { lines: [], ...pay }, userId)).toMatchObject({ ok: false, error: { code: 'NO_LINES' } })
  })

  it('short payment is refused', () => {
    const { db, userId } = setup()
    const a = item(db)
    const res = completeSale(db, { lines: [{ itemId: a, qty: 2 }], paidCash: 999, paidCredit: 0 }, userId)
    expect(res).toMatchObject({ ok: false, error: { code: 'PAYMENT_SHORT' } })
  })
})

describe('stock', () => {
  it('blocks insufficient stock by default and rolls back everything', () => {
    const { db, userId } = setup()
    const a = item(db, { openingStock: { qty: 5 } })
    const b = item(db)
    const before = counts(db)
    const res = completeSale(db, {
      lines: [{ itemId: b, qty: 1 }, { itemId: a, qty: 6 }], paidCash: 100000, paidCredit: 0
    }, userId)
    expect(res).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_STOCK' } })
    expect(counts(db)).toEqual(before)
    expect(getItemStock(db, b)).toBe(1000)
    expect(getItemStock(db, a)).toBe(5)
  })

  it('the same item on two lines cannot oversell', () => {
    const { db, userId } = setup()
    const a = item(db, { openingStock: { qty: 5 } })
    const res = completeSale(db, {
      lines: [{ itemId: a, qty: 3 }, { itemId: a, qty: 3 }], paidCash: 100000, paidCredit: 0
    }, userId)
    expect(res).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_STOCK' } })
    expect(getItemStock(db, a)).toBe(5)
  })

  it('allow_negative_stock lets stock-tracked non-lot items go below zero', () => {
    const { db, userId } = setup()
    const a = item(db, { openingStock: { qty: 2 } })
    setSetting(db, 'allow_negative_stock', '1')
    const res = completeSale(db, { lines: [{ itemId: a, qty: 5 }], paidCash: 2500, paidCredit: 0 }, userId)
    expect(res.ok).toBe(true)
    expect(getItemStock(db, a)).toBe(-3)
  })

  it('items that do not track stock sell without movements', () => {
    const { db, userId } = setup()
    const s = item(db, { trackStock: false, openingStock: undefined, units: [] })
    const before = counts(db).mv
    const res = completeSale(db, { lines: [{ itemId: s, qty: 4 }], paidCash: 2000, paidCredit: 0 }, userId)
    expect(res.ok).toBe(true)
    expect(counts(db).mv).toBe(before)
  })

  it('lot items: oldest lot first, line spans lots, never negative even with the setting on', () => {
    const { db, userId, supplierId } = setup()
    const a = item(db, { trackLots: true, openingStock: undefined, units: [] })
    for (const [lotNo, qty] of [['L1', 10], ['L2', 20]] as const) {
      const p = createPurchase(db, {
        supplierId, lines: [{ itemId: a, qty, unitCost: 300, lotNo, expiryDate: '2030-01-31' }]
      }, userId)
      expect(p.ok).toBe(true)
    }
    const lots = db.prepare('SELECT id FROM stock_lots WHERE item_id = ? ORDER BY id').all(a) as Array<{ id: number }>
    const res = completeSale(db, { lines: [{ itemId: a, qty: 15 }], paidCash: 7500, paidCredit: 0 }, userId)
    expect(res.ok).toBe(true)
    expect(getLotStock(db, lots[0].id)).toBe(0)
    expect(getLotStock(db, lots[1].id)).toBe(15)
    const chunks = db.prepare('SELECT lot_id, qty_base, cost_price FROM sale_line_lots ORDER BY id').all()
    expect(chunks).toEqual([
      { lot_id: lots[0].id, qty_base: 10, cost_price: 300 },
      { lot_id: lots[1].id, qty_base: 5, cost_price: 300 }
    ])
    setSetting(db, 'allow_negative_stock', '1')
    const over = completeSale(db, { lines: [{ itemId: a, qty: 16 }], paidCash: 8000, paidCredit: 0 }, userId)
    expect(over).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_STOCK' } })
  })

  it('a module allocator overrides the default and onSaleCompleted runs in the transaction', () => {
    const { db, userId, supplierId } = setup()
    const a = item(db, { trackLots: true, openingStock: undefined, units: [] })
    for (const lotNo of ['L1', 'L2']) {
      createPurchase(db, { supplierId, lines: [{ itemId: a, qty: 10, unitCost: 300, lotNo, expiryDate: '2030-01-31' }] }, userId)
    }
    const lots = db.prepare('SELECT id FROM stock_lots ORDER BY id DESC').all() as Array<{ id: number }>
    const seen: number[] = []
    const mod: MainModule = {
      id: 'test', migrations: [], registerIpc: () => {},
      stockAllocator: { allocate: (_db, _item, qty) => [{ lotId: lots[0].id, qtyBase: qty }] }, // newest first
      onSaleCompleted: (_ctx, saleId) => { seen.push(saleId) }
    }
    const res = completeSale(db, { lines: [{ itemId: a, qty: 4 }], paidCash: 2000, paidCredit: 0 }, userId, { modules: [mod] })
    expect(res.ok).toBe(true)
    expect(getLotStock(db, lots[0].id)).toBe(6)
    expect(seen).toEqual([res.ok ? res.data.sale.id : -1])

    const failing: MainModule = { ...mod, onSaleCompleted: () => { throw new Error('hook failed') } }
    const before = counts(db)
    expect(() => completeSale(db, { lines: [{ itemId: a, qty: 1 }], paidCash: 500, paidCredit: 0 }, userId, { modules: [failing] })).toThrow('hook failed')
    expect(counts(db)).toEqual(before)
  })
})

describe('credit / ledger', () => {
  it('credit sale debits the customer; mixed puts only the credit part on khata', () => {
    const { db, userId, customerId } = setup()
    const a = item(db)
    const credit = completeSale(db, { partyId: customerId, lines: [{ itemId: a, qty: 4 }], paidCash: 0, paidCredit: 2000 }, userId)
    expect(credit.ok).toBe(true)
    expect(getBalance(db, customerId)).toBe(2000)
    const mixed = completeSale(db, { partyId: customerId, lines: [{ itemId: a, qty: 4 }], paidCash: 500, paidCredit: 1500 }, userId)
    expect(mixed.ok).toBe(true)
    if (!mixed.ok) return
    expect(mixed.data.sale.paidCash).toBe(500)
    expect(mixed.data.sale.paidCredit).toBe(1500)
    expect(getBalance(db, customerId)).toBe(3500)
    const row = db.prepare("SELECT type, debit, ref_type, ref_id FROM party_ledger WHERE ref_id = ?").get(mixed.data.sale.id)
    expect(row).toEqual({ type: 'sale', debit: 1500, ref_type: 'sale', ref_id: mixed.data.sale.id })
  })

  it('cash sale with a customer attached touches no ledger', () => {
    const { db, userId, customerId } = setup()
    const a = item(db)
    completeSale(db, { partyId: customerId, lines: [{ itemId: a, qty: 2 }], paidCash: 1000, paidCredit: 0 }, userId)
    expect(getBalance(db, customerId)).toBe(0)
  })

  it('credit needs a real, active customer', () => {
    const { db, userId, supplierId, customerId } = setup()
    const a = item(db)
    const base = { lines: [{ itemId: a, qty: 2 }], paidCash: 0, paidCredit: 1000 }
    expect(completeSale(db, base, userId)).toMatchObject({ ok: false, error: { code: 'CUSTOMER_REQUIRED' } })
    expect(completeSale(db, { ...base, partyId: supplierId }, userId)).toMatchObject({ ok: false, error: { code: 'WRONG_PARTY_TYPE' } })
    db.prepare('UPDATE parties SET active = 0 WHERE id = ?').run(customerId)
    expect(completeSale(db, { ...base, partyId: customerId }, userId)).toMatchObject({ ok: false, error: { code: 'PARTY_INACTIVE' } })
  })

  it('credit limit blocks and message names the room left; 0 means no limit', () => {
    const { db, userId, customerId } = setup()
    const a = item(db)
    updateParty(db, { id: customerId, name: 'Ali', creditLimit: 3000 })
    const sell = (credit: number) =>
      completeSale(db, { partyId: customerId, lines: [{ itemId: a, qty: credit / 500 }], paidCash: 0, paidCredit: credit }, userId)
    expect(sell(2000).ok).toBe(true)
    const blocked = sell(1500)
    expect(blocked).toMatchObject({ ok: false, error: { code: 'CREDIT_LIMIT_EXCEEDED' } })
    if (!blocked.ok) expect(blocked.error.message).toContain('10.00')
    expect(sell(1000).ok).toBe(true) // exactly at the limit
    expect(getBalance(db, customerId)).toBe(3000)
    updateParty(db, { id: customerId, name: 'Ali', creditLimit: 0 })
    expect(sell(50000).ok).toBe(true)
  })

  it('a failing ledger post rolls back the stock and invoice', () => {
    const { db, userId, customerId } = setup()
    const a = item(db)
    db.exec("CREATE TRIGGER no_ledger BEFORE INSERT ON party_ledger BEGIN SELECT RAISE(ABORT, 'ledger down'); END")
    const before = counts(db)
    expect(() => completeSale(db, { partyId: customerId, lines: [{ itemId: a, qty: 2 }], paidCash: 0, paidCredit: 1000 }, userId)).toThrow()
    expect(counts(db)).toEqual(before)
    expect(getItemStock(db, a)).toBe(1000)
    expect(nextNo(db)).toBeUndefined()
  })
})

describe('invoice numbering', () => {
  it('is sequential, and a rolled-back sale leaves no gap', () => {
    const { db, userId } = setup()
    const a = item(db, { openingStock: { qty: 3 } })
    const ok = (qty: number) => completeSale(db, { lines: [{ itemId: a, qty }], paidCash: 100000, paidCredit: 0 }, userId)
    const r1 = ok(1)
    const bad = ok(50)
    const r2 = ok(1)
    expect(bad.ok).toBe(false)
    expect(r1.ok && r1.data.sale.invoiceNo).toBe('000001')
    expect(r2.ok && r2.data.sale.invoiceNo).toBe('000002')
    expect(nextNo(db)).toBe('3')
  })

  it('continues from a configured counter and skips numbers already used', () => {
    const { db, userId } = setup()
    const a = item(db)
    setSetting(db, 'next_invoice_no', '41')
    const r = completeSale(db, { lines: [{ itemId: a, qty: 1 }], paidCash: 500, paidCredit: 0 }, userId)
    expect(r.ok && r.data.sale.invoiceNo).toBe('000041')
    setSetting(db, 'next_invoice_no', '41')
    const r2 = completeSale(db, { lines: [{ itemId: a, qty: 1 }], paidCash: 500, paidCredit: 0 }, userId)
    expect(r2.ok && r2.data.sale.invoiceNo).toBe('000042')
  })
})

describe('held bills', () => {
  it('hold -> list -> recall data -> complete uses the same row (no duplicate)', () => {
    const { db, userId, customerId } = setup()
    const a = item(db)
    const held = holdSale(db, {
      partyId: customerId, lines: [{ itemId: a, qty: 2, discountBp: 500 }, { itemId: a, unitId: unitId(db, a, 'Box'), qty: 1 }],
      billDiscount: 100, note: 'wait'
    }, userId)
    expect(held.ok).toBe(true)
    if (!held.ok) return
    expect(held.data.status).toBe('held')
    expect(held.data.invoiceNo).toBeNull()
    expect(getItemStock(db, a)).toBe(1000) // nothing posted yet
    expect(listSales(db, { status: 'held' })).toHaveLength(1)

    const recalled = getSale(db, held.data.id)!
    expect(recalled.lines.map((l) => [l.itemId, l.unitId, l.qty, l.discountBp])).toEqual([
      [a, null, 2, 500], [a, unitId(db, a, 'Box'), 1, null]
    ])
    expect(recalled.billDiscount).toBe(100)
    expect(recalled.partyId).toBe(customerId)

    const done = completeSale(db, {
      partyId: customerId, heldSaleId: held.data.id,
      lines: [{ itemId: a, qty: 2 }], paidCash: 1000, paidCredit: 0
    }, userId)
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.data.sale.id).toBe(held.data.id)
    expect(done.data.sale.status).toBe('completed')
    expect(done.data.sale.lines).toHaveLength(1)
    expect((db.prepare('SELECT COUNT(*) AS n FROM sales').get() as { n: number }).n).toBe(1)
    expect(listSales(db, { status: 'held' })).toHaveLength(0)

    // Completing the same held bill again must fail and not double-post.
    const again = completeSale(db, { heldSaleId: held.data.id, lines: [{ itemId: a, qty: 2 }], paidCash: 1000, paidCredit: 0 }, userId)
    expect(again).toMatchObject({ ok: false, error: { code: 'HELD_NOT_FOUND' } })
    expect(getItemStock(db, a)).toBe(998)
  })

  it('re-holding updates the row; discard removes the draft only', () => {
    const { db, userId } = setup()
    const a = item(db)
    const h1 = holdSale(db, { lines: [{ itemId: a, qty: 1 }] }, userId)
    if (!h1.ok) throw new Error('hold')
    const h2 = holdSale(db, { lines: [{ itemId: a, qty: 5 }], heldSaleId: h1.data.id }, userId)
    expect(h2.ok && h2.data.id).toBe(h1.data.id)
    expect(listSales(db, { status: 'held' })).toHaveLength(1)
    expect(getSale(db, h1.data.id)!.lines[0].qty).toBe(5)
    expect(discardHeld(db, h1.data.id, userId).ok).toBe(true)
    expect(getSale(db, h1.data.id)).toBeNull()
    expect(discardHeld(db, h1.data.id, userId)).toMatchObject({ ok: false, error: { code: 'HELD_NOT_FOUND' } })
    expect(holdSale(db, { lines: [] }, userId).ok).toBe(false)
  })

  it('a completed sale cannot be overwritten through heldSaleId', () => {
    const { db, userId } = setup()
    const a = item(db)
    const r = completeSale(db, { lines: [{ itemId: a, qty: 1 }], paidCash: 500, paidCredit: 0 }, userId)
    if (!r.ok) throw new Error('sale')
    const h = holdSale(db, { lines: [{ itemId: a, qty: 9 }], heldSaleId: r.data.sale.id }, userId)
    expect(h).toMatchObject({ ok: false, error: { code: 'HELD_NOT_FOUND' } })
    expect(getSale(db, r.data.sale.id)!.lines[0].qty).toBe(1)
  })
})

describe('audit', () => {
  it('writes an audit row per completed sale', () => {
    const { db, userId } = setup()
    const a = item(db)
    completeSale(db, { lines: [{ itemId: a, qty: 1 }], paidCash: 500, paidCredit: 0 }, userId)
    const row = db.prepare("SELECT action, entity FROM audit_log WHERE action = 'sale_completed'").get()
    expect(row).toEqual({ action: 'sale_completed', entity: 'sales' })
  })
})
