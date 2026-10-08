import { beforeEach, describe, expect, it } from 'vitest'
import { addDaysLocal, todayLocal } from '@shared/dates'
import { createTestDb } from '../../db/test-helper'
import { createUser } from '../../core/users/service'
import { createParty } from '../../core/parties/service'
import { createItem, updateItem } from '../../core/items/service'
import { createPurchase } from '../../core/purchases/service'
import { openShift } from '../../core/cash/service'
import { completeSale } from '../../core/sales/service'
import { resetApprovalLocksForTest } from '../../core/sales/approval'
import { findOrCreateLot, getLotStock, postMovement } from '../../core/stock/service'
import { setEnabledModuleIds } from '../registry'
import { pharmacyMainModule } from './index'
import { getItemInfo } from './info'
import { previewAllocation } from './fefo'
import { expirySummary, listExpiry } from './expiry'
import { addManual, listWantBook, setStatus } from './wantbook'

type Db = ReturnType<typeof createTestDb>
const deps = { modules: [pharmacyMainModule] }
const today = todayLocal()
const inDays = (n: number): string => addDaysLocal(today, n)

let seq = 0
interface Ctx { db: Db; cashier: number; ownerId: number; managerId: number; supplier: number }

function setup(withModule = true): Ctx {
  resetApprovalLocksForTest()
  const db = createTestDb()
  if (withModule) {
    const r = setEnabledModuleIds(db, ['pharmacy'])
    if (!r.ok) throw new Error(r.error.message)
  }
  const cashier = createUser(db, { name: 'C', username: 'c', pin: '1111', role: 'cashier' }).id
  const ownerId = createUser(db, { name: 'O', username: 'o', pin: '2222', role: 'owner' }).id
  const managerId = createUser(db, { name: 'M', username: 'm', pin: '3333', role: 'manager' }).id
  openShift(db, { openingCash: 0 }, cashier)
  const sup = createParty(db, { type: 'supplier', name: 'Hamid Traders' })
  if (!sup.ok) throw new Error('supplier')
  return { db, cashier, ownerId, managerId, supplier: sup.data.id }
}

function medicine(db: Db, extra: Partial<Parameters<typeof createItem>[1]> = {}): number {
  const r = createItem(db, { name: `Med ${++seq}`, baseUnit: 'tablet', salePrice: 100, costPrice: 60, trackLots: true, ...extra }, null, deps)
  if (!r.ok) throw new Error(r.error.message)
  return r.data.id
}

function buy(c: Ctx, itemId: number, lotNo: string, expiry: string, qty: number, supplierId = c.supplier): number {
  const r = createPurchase(c.db, { supplierId, lines: [{ itemId, qty, unitCost: 60, lotNo, expiryDate: expiry }] }, c.cashier)
  if (!r.ok) throw new Error(r.error.message)
  return r.data.lines[0].lotId!
}

function sell(c: Ctx, itemId: number, qty: number, extra: object = {}, userId = c.cashier) {
  return completeSale(c.db, { lines: [{ itemId, qty }], paidCash: 1_000_000, paidCredit: 0, ...extra }, userId, deps)
}

beforeEach(() => { seq = 0 })

describe('FEFO allocator', () => {
  it('sells the earliest-expiring lot first, across several lots', () => {
    const c = setup()
    const m = medicine(c.db)
    const far = buy(c, m, 'FAR', inDays(300), 10)
    const near = buy(c, m, 'NEAR', inDays(40), 10)
    const mid = buy(c, m, 'MID', inDays(100), 10)
    const r = sell(c, m, 25)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.sale.lines[0].lots.map((l) => [l.lotNo, l.qtyBase])).toEqual([['NEAR', 10], ['MID', 10], ['FAR', 5]])
    expect(r.data.sale.lines[0].lots[0].expiryDate).toBe(inDays(40))
    expect(getLotStock(c.db, near)).toBe(0)
    expect(getLotStock(c.db, mid)).toBe(0)
    expect(getLotStock(c.db, far)).toBe(5)
  })

  it('lots with no expiry are used last', () => {
    const c = setup()
    const m = medicine(c.db)
    buy(c, m, 'DATED', inDays(500), 5)
    const lot = findOrCreateLot(c.db, { itemId: m, lotNo: 'NOEXP', expiryDate: null, costPrice: 60 })
    if (!lot.ok) throw new Error('lot')
    postMovement(c.db, { itemId: m, lotId: lot.data, qty: 5, type: 'adjust' })
    const r = sell(c, m, 7)
    expect(r.ok && r.data.sale.lines[0].lots.map((l) => [l.lotNo, l.qtyBase])).toEqual([['DATED', 5], ['NOEXP', 2]])
  })

  it('a lot is still sellable on its expiry day', () => {
    const c = setup()
    const m = medicine(c.db)
    buy(c, m, 'TODAY', today, 5)
    expect(sell(c, m, 2).ok).toBe(true)
  })

  it('blocks expired lots: valid stock is used, expired is never touched', () => {
    const c = setup()
    const m = medicine(c.db)
    const old = buy(c, m, 'OLD', inDays(-10), 10)
    buy(c, m, 'GOOD', inDays(200), 4)
    const ok = sell(c, m, 3)
    expect(ok.ok && ok.data.sale.lines[0].lots.map((l) => l.lotNo)).toEqual(['GOOD'])

    const before = c.db.prepare('SELECT COUNT(*) AS n FROM sales').get() as { n: number }
    const blocked = sell(c, m, 3) // only 1 valid left, expired would be needed
    expect(blocked).toMatchObject({ ok: false, error: { code: 'OWNER_OVERRIDE_REQUIRED' } })
    expect((c.db.prepare('SELECT COUNT(*) AS n FROM sales').get() as { n: number }).n).toBe(before.n)
    expect(getLotStock(c.db, old)).toBe(10)
  })

  it('only expired stock and not enough of it: plain insufficient stock', () => {
    const c = setup()
    const m = medicine(c.db)
    buy(c, m, 'OLD', inDays(-10), 2)
    expect(sell(c, m, 5)).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_STOCK' } })
  })

  it('owner PIN overrides and the audit log records it; manager or wrong PIN cannot', () => {
    const c = setup()
    const m = medicine(c.db)
    const old = buy(c, m, 'OLD', inDays(-3), 10)
    buy(c, m, 'GOOD', inDays(200), 2)

    expect(sell(c, m, 5, { overrideApproval: { userId: c.managerId, pin: '3333' } })).toMatchObject({ ok: false, error: { code: 'INVALID_APPROVAL' } })
    expect(sell(c, m, 5, { overrideApproval: { userId: c.ownerId, pin: '9999' } })).toMatchObject({ ok: false, error: { code: 'INVALID_APPROVAL' } })
    expect(c.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'expired_sale_override'").get()).toEqual({ n: 0 })

    const r = sell(c, m, 5, { overrideApproval: { userId: c.ownerId, pin: '2222' } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.sale.lines[0].lots.map((l) => [l.lotNo, l.qtyBase])).toEqual([['GOOD', 2], ['OLD', 3]])
    expect(getLotStock(c.db, old)).toBe(7)
    const audit = c.db.prepare("SELECT user_id, entity, entity_id, details FROM audit_log WHERE action = 'expired_sale_override'").all() as Array<{ user_id: number; entity: string; entity_id: number; details: string }>
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ user_id: c.ownerId, entity: 'stock_lots', entity_id: old })
    expect(JSON.parse(audit[0].details)).toMatchObject({ lotNo: 'OLD', qtyBase: 3, soldBy: c.cashier, saleId: r.data.sale.id })
  })

  it('an override PIN that is not needed changes nothing and logs nothing', () => {
    const c = setup()
    const m = medicine(c.db)
    buy(c, m, 'GOOD', inDays(200), 5)
    expect(sell(c, m, 2, { overrideApproval: { userId: c.ownerId, pin: '2222' } }).ok).toBe(true)
    expect(c.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'expired_sale_override'").get()).toEqual({ n: 0 })
  })

  it('previewAllocation shows batch + expiry and flags an override', () => {
    const c = setup()
    const m = medicine(c.db)
    buy(c, m, 'OLD', inDays(-3), 10)
    buy(c, m, 'GOOD', inDays(20), 2)
    const p1 = previewAllocation(c.db, m, 2)
    expect(p1).toMatchObject({ tracked: true, needsOverride: false, shortBase: 0 })
    expect(p1.chunks).toMatchObject([{ lotNo: 'GOOD', expiryDate: inDays(20), qtyBase: 2, expired: false }])
    const p2 = previewAllocation(c.db, m, 5)
    expect(p2.needsOverride).toBe(true)
    expect(p2.chunks.map((x) => [x.lotNo, x.expired])).toEqual([['GOOD', false], ['OLD', true]])
    expect(previewAllocation(c.db, m, 100)).toMatchObject({ needsOverride: false, shortBase: 98 })
    const plain = createItem(c.db, { name: 'Plain', baseUnit: 'pc', salePrice: 1, costPrice: 1 })
    if (!plain.ok) throw new Error('x')
    expect(previewAllocation(c.db, plain.data.id, 1).tracked).toBe(false)
  })
})

describe('item form data and purchase rules', () => {
  it('saves pharmacy info atomically with the item, and a bad block saves nothing', () => {
    const c = setup()
    const info = { genericName: 'Paracetamol', manufacturer: 'GSK', strength: '500mg', form: 'Tablet', schedule: 'otc', rack: 'A1' }
    const r = createItem(c.db, { name: 'Panadol', baseUnit: 'tablet', salePrice: 100, costPrice: 60, trackLots: true, moduleData: { pharmacy: info } }, null, deps)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(getItemInfo(c.db, r.data.id)).toEqual(info)

    const bad = createItem(c.db, { name: 'Bad', baseUnit: 'tablet', salePrice: 1, costPrice: 1, moduleData: { pharmacy: { ...info, schedule: 'nope' } } }, null, deps)
    expect(bad).toMatchObject({ ok: false, error: { code: 'INVALID_PHARMACY_INFO' } })
    expect(c.db.prepare("SELECT COUNT(*) AS n FROM items WHERE name = 'Bad'").get()).toEqual({ n: 0 })

    const up = updateItem(c.db, { id: r.data.id, name: 'Panadol', baseUnit: 'tablet', salePrice: 100, costPrice: 60, trackLots: true, moduleData: { pharmacy: { ...info, rack: 'B2', schedule: 'rx' } } }, null, deps)
    expect(up.ok).toBe(true)
    expect(getItemInfo(c.db, r.data.id)).toMatchObject({ rack: 'B2', schedule: 'rx' })
  })

  it('purchase needs a batch number and an expiry for lot-tracked medicines', () => {
    const c = setup()
    const m = medicine(c.db)
    const base = { supplierId: c.supplier }
    expect(createPurchase(c.db, { ...base, lines: [{ itemId: m, qty: 1, unitCost: 60, expiryDate: inDays(100) }] }, c.cashier)).toMatchObject({ ok: false, error: { code: 'LOT_REQUIRED' } })
    expect(createPurchase(c.db, { ...base, lines: [{ itemId: m, qty: 1, unitCost: 60, lotNo: 'B1' }] }, c.cashier)).toMatchObject({ ok: false, error: { code: 'EXPIRY_REQUIRED' } })
  })
})

describe('expiry console', () => {
  it('buckets: expired, 30, 60, 90 days, and ignores sold-out and far lots', () => {
    const c = setup()
    const a = medicine(c.db)
    const b = medicine(c.db)
    buy(c, a, 'E1', inDays(-1), 5)
    buy(c, a, 'D10', inDays(10), 5)
    buy(c, a, 'D30', inDays(30), 5)
    buy(c, b, 'D31', inDays(31), 5)
    buy(c, b, 'D75', inDays(75), 5)
    buy(c, b, 'D90', inDays(90), 5)
    buy(c, b, 'D91', inDays(91), 5)
    const gone = buy(c, b, 'GONE', inDays(5), 3)
    postMovement(c.db, { itemId: b, lotId: gone, qty: -3, type: 'adjust' })

    const lots = (range: 'expired' | 30 | 60 | 90): string[] => listExpiry(c.db, { range }).map((r) => r.lotNo)
    expect(lots('expired')).toEqual(['E1'])
    expect(lots(30)).toEqual(['D10', 'D30'])
    expect(lots(60)).toEqual(['D10', 'D30', 'D31'])
    expect(lots(90)).toEqual(['D10', 'D30', 'D31', 'D75', 'D90'])
    expect(expirySummary(c.db)).toEqual({ expired: 1, within30: 2, within60: 3, within90: 5 })
    expect(listExpiry(c.db, { range: 30 })[0]).toMatchObject({ daysLeft: 10, qtyBase: 5, supplierName: 'Hamid Traders' })
    expect(listExpiry(c.db, { range: 'expired' })[0].daysLeft).toBe(-1)
  })

  it('filters by the supplier of the purchase that created the lot', () => {
    const c = setup()
    const other = createParty(c.db, { type: 'supplier', name: 'Zaman' })
    if (!other.ok) throw new Error('s')
    const m = medicine(c.db)
    buy(c, m, 'H1', inDays(10), 5)
    buy(c, m, 'Z1', inDays(12), 5, other.data.id)
    expect(listExpiry(c.db, { range: 30, supplierId: other.data.id }).map((r) => r.lotNo)).toEqual(['Z1'])
    expect(listExpiry(c.db, { range: 30, supplierId: c.supplier }).map((r) => r.lotNo)).toEqual(['H1'])
    expect(listExpiry(c.db, { range: 30 })).toHaveLength(2)
  })
})

describe('want-book', () => {
  it('auto-adds when stock reaches the reorder level, once, with the last supplier', () => {
    const c = setup()
    const m = medicine(c.db, { reorderLevel: 10 })
    buy(c, m, 'L1', inDays(200), 12)
    expect(sell(c, m, 1).ok).toBe(true) // 11 left, above level
    expect(listWantBook(c.db)).toHaveLength(0)

    expect(sell(c, m, 1).ok).toBe(true) // 10 = at level
    let list = listWantBook(c.db)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ itemId: m, source: 'auto', status: 'open', supplierName: 'Hamid Traders', qty: 10 })

    expect(sell(c, m, 2).ok).toBe(true) // still low: no duplicate
    expect(listWantBook(c.db)).toHaveLength(1)
    setStatus(c.db, list[0].id, 'ordered')
    expect(sell(c, m, 1).ok).toBe(true) // ordered counts as still on the list
    expect(listWantBook(c.db)).toHaveLength(1)

    setStatus(c.db, list[0].id, 'done')
    expect(sell(c, m, 1).ok).toBe(true)
    list = listWantBook(c.db)
    expect(list).toHaveLength(1)
    expect(list[0].id).not.toBe(1)
  })

  it('rolls back with the sale and ignores items above their level', () => {
    const c = setup()
    const m = medicine(c.db, { reorderLevel: 10 })
    buy(c, m, 'L1', inDays(200), 11)
    expect(sell(c, m, 50)).toMatchObject({ ok: false })
    expect(listWantBook(c.db)).toHaveLength(0)
  })

  it('manual add: free text, item, no duplicate for a listed item, validation', () => {
    const c = setup()
    const m = medicine(c.db)
    const free = addManual(c.db, { freeText: ' Cough syrup ', qty: 3 })
    expect(free.ok && free.data).toMatchObject({ itemId: null, itemName: 'Cough syrup', source: 'manual', qty: 3 })
    const a = addManual(c.db, { itemId: m, qty: 5, supplierId: c.supplier })
    const b = addManual(c.db, { itemId: m, qty: 9 })
    expect(a.ok && b.ok && a.data.id === b.data.id).toBe(true)
    expect(listWantBook(c.db)).toHaveLength(2)
    expect(addManual(c.db, { qty: 1 })).toMatchObject({ ok: false, error: { code: 'ITEM_REQUIRED' } })
    expect(addManual(c.db, { itemId: m, qty: 0 })).toMatchObject({ ok: false, error: { code: 'INVALID_QTY' } })
    expect(addManual(c.db, { freeText: 'x', qty: 1, supplierId: 9999 })).toMatchObject({ ok: false, error: { code: 'WRONG_PARTY_TYPE' } })
  })
})

describe('core without the pharmacy module', () => {
  it('sells normally: default allocator, no pharmacy tables, module data ignored', () => {
    const c = setup(false)
    expect(c.db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'pharmacy_%'").all()).toEqual([])
    const item = createItem(c.db, { name: 'Soap', baseUnit: 'pc', salePrice: 100, costPrice: 60, openingStock: { qty: 10 }, reorderLevel: 20, moduleData: { pharmacy: { schedule: 'bad' } } }, c.cashier, { modules: [] })
    if (!item.ok) throw new Error(item.error.message)
    const r = completeSale(c.db, { lines: [{ itemId: item.data.id, qty: 2 }], paidCash: 200, paidCredit: 0 }, c.cashier, { modules: [] })
    expect(r.ok).toBe(true)
    expect(r.ok && r.data.sale.total).toBe(200)

    // lots still work with the plain oldest-lot-first allocator, even for expired dates
    const t = createItem(c.db, { name: 'Lot item', baseUnit: 'pc', salePrice: 10, costPrice: 5, trackLots: true }, c.cashier, { modules: [] })
    if (!t.ok) throw new Error('t')
    buy(c, t.data.id, 'OLD', inDays(-5), 4)
    expect(completeSale(c.db, { lines: [{ itemId: t.data.id, qty: 2 }], paidCash: 20, paidCredit: 0 }, c.cashier, { modules: [] }).ok).toBe(true)
  })
})
