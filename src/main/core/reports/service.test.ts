import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import { createUser } from '../users/service'
import { createParty } from '../parties/service'
import { createItem, deactivateItem } from '../items/service'
import { createPurchase } from '../purchases/service'
import { recordPayment } from '../ledger/service'
import { openShift } from '../cash/service'
import { completeSale, returnSale, voidSale } from '../sales/service'
import { resetApprovalLocksForTest } from '../sales/approval'
import { getLowStock, getPayables, getReceivables, getSalesReport, getStockValue, isValidRange } from './service'

const DAY1 = '2026-10-01'
const DAY2 = '2026-10-02'

function must<T>(r: { ok: true; data: T } | { ok: false; error: { message: string } }): T {
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}

/**
 * Seed: A (cost 300, price 500, tracked), B (not stock-tracked, cost 200, price 400),
 * L (lot-tracked, lot cost 250, item cost 999, price 600).
 * S1 day1 cashier: A x10 (Ali, 3000 on khata). S2 day1 cashier: B x5. S3 day2 manager: L x4.
 * S4 day2 cashier: A x2, then VOIDED. Return R1 day2 by manager: A x3 from S1 (refund 1500).
 */
function seed() {
  resetApprovalLocksForTest()
  const db = createTestDb()
  const mk = (username: string, role: 'cashier' | 'manager' | 'owner') =>
    createUser(db, { name: username, username, pin: '1234', role }) as unknown as { id: number }
  const cashier = mk('cash', 'cashier').id
  const manager = mk('mgr', 'manager').id
  openShift(db, { openingCash: 0 }, cashier)
  const ali = must(createParty(db, { type: 'customer', name: 'Ali' })).id
  const bilal = must(createParty(db, { type: 'customer', name: 'Bilal' })).id
  const hamid = must(createParty(db, { type: 'supplier', name: 'Hamid' })).id
  const zain = must(createParty(db, { type: 'supplier', name: 'Zain' })).id

  const A = must(createItem(db, { name: 'A', baseUnit: 'tablet', salePrice: 500, costPrice: 300, openingStock: { qty: 1000 } })).id
  const B = must(createItem(db, { name: 'B', baseUnit: 'pc', salePrice: 400, costPrice: 200, trackStock: false })).id
  const L = must(createItem(db, { name: 'L', baseUnit: 'pc', salePrice: 600, costPrice: 999, trackLots: true })).id
  must(createPurchase(db, { supplierId: hamid, lines: [{ itemId: L, qty: 100, unitCost: 250, lotNo: 'L1', expiryDate: '2030-01-01' }], paid: 5000 }, manager))
  must(createPurchase(db, { supplierId: zain, lines: [{ itemId: A, qty: 10, unitCost: 300 }], paid: 3000 }, manager))

  const sell = (userId: number, input: Parameters<typeof completeSale>[1], day: string) => {
    const sale = must(completeSale(db, input, userId)).sale
    db.prepare('UPDATE sales SET created_at = ? WHERE id = ?').run(`${day} 10:00:00`, sale.id)
    return sale
  }
  const s1 = sell(cashier, { partyId: ali, lines: [{ itemId: A, qty: 10 }], paidCash: 2000, paidCredit: 3000 }, DAY1)
  sell(cashier, { lines: [{ itemId: B, qty: 5 }], paidCash: 2000, paidCredit: 0 }, DAY1)
  sell(manager, { lines: [{ itemId: L, qty: 4 }], paidCash: 2400, paidCredit: 0 }, DAY2)
  const s4 = sell(cashier, { lines: [{ itemId: A, qty: 2 }], paidCash: 1000, paidCredit: 0 }, DAY2)
  must(voidSale(db, { saleId: s4.id, reason: 'mistake', approval: { userId: manager, pin: '1234' } }, cashier))

  const ret = must(returnSale(db, { saleId: s1.id, lines: [{ saleLineId: s1.lines[0].id, qtyBase: 3 }] }, { id: manager, role: 'manager' }))
  db.prepare('UPDATE sale_returns SET created_at = ? WHERE id = ?').run(`${DAY2} 12:00:00`, ret.returnId)

  // Bilal buys on khata then pays it all back.
  const s5 = sell(cashier, { partyId: bilal, lines: [{ itemId: B, qty: 1 }], paidCash: 0, paidCredit: 400 }, DAY1)
  expect(s5.total).toBe(400)
  must(recordPayment(db, { partyId: bilal, amount: 400 }, cashier))
  return { db, cashier, manager, A, B, L }
}

beforeEach(() => resetApprovalLocksForTest())

describe('sales report', () => {
  it('by day: excludes void, subtracts returns on the return date, lot cost wins over item cost', () => {
    const { db } = seed()
    const r = getSalesReport(db, { from: DAY1, to: DAY2, groupBy: 'day' })
    // Bilal's 400 sale (B, cost 200) sits on day 1 too: sales 7400, cost 4200.
    expect(r.rows.map((x) => x.key)).toEqual([DAY1, DAY2])
    expect(r.rows[0]).toMatchObject({ invoices: 3, sales: 7400, returns: 0, cost: 4200, profit: 3200 })
    // Day 2: L x4 = 2400 (lot cost 4 x 250 = 1000); void excluded; return 1500 with cost 3 x 300 = 900 back.
    expect(r.rows[1]).toMatchObject({ invoices: 1, sales: 2400, returns: 1500, cost: 100, profit: 800 })
    expect(r.totals).toEqual({ invoices: 4, sales: 9800, returns: 1500, cost: 4300, profit: 4000 })
  })

  it('respects the date range (inclusive) and rejects a backwards range', () => {
    const { db } = seed()
    const d2 = getSalesReport(db, { from: DAY2, to: DAY2, groupBy: 'day' })
    expect(d2.totals).toMatchObject({ invoices: 1, sales: 2400, returns: 1500 })
    const none = getSalesReport(db, { from: '2026-09-01', to: '2026-09-30', groupBy: 'day' })
    expect(none.rows).toEqual([])
    expect(none.totals.profit).toBe(0)
    expect(isValidRange({ from: DAY2, to: DAY1 })).toBe(false)
    expect(isValidRange({ from: DAY1, to: DAY1 })).toBe(true)
  })

  it('by item: net quantity, cost from lots / item cost snapshot, sorted by profit', () => {
    const { db } = seed()
    const r = getSalesReport(db, { from: DAY1, to: DAY2, groupBy: 'item' })
    const by = Object.fromEntries(r.rows.map((x) => [x.label, x]))
    expect(by.A).toMatchObject({ qty: 7, sales: 5000, returns: 1500, cost: 2100, profit: 1400 })
    expect(by.B).toMatchObject({ qty: 6, sales: 2400, returns: 0, cost: 1200, profit: 1200 })
    expect(by.L).toMatchObject({ qty: 4, sales: 2400, cost: 1000, profit: 1400 })
    expect(r.rows[r.rows.length - 1].profit).toBeLessThanOrEqual(r.rows[0].profit)
    expect(r.totals.profit).toBe(4000)
  })

  it('cost is frozen at sale time: changing the item cost later does not change profit', () => {
    const { db, B } = seed()
    db.prepare('UPDATE items SET cost_price = 5000 WHERE id = ?').run(B)
    const r = getSalesReport(db, { from: DAY1, to: DAY2, groupBy: 'item' })
    expect(r.rows.find((x) => x.label === 'B')).toMatchObject({ cost: 1200, profit: 1200 })
  })

  it('by user: the return counts against the user who made it', () => {
    const { db } = seed()
    const r = getSalesReport(db, { from: DAY1, to: DAY2, groupBy: 'user' })
    const by = Object.fromEntries(r.rows.map((x) => [x.label, x]))
    expect(by.cash).toMatchObject({ invoices: 3, sales: 7400, returns: 0, cost: 4200, profit: 3200 })
    expect(by.mgr).toMatchObject({ invoices: 1, sales: 2400, returns: 1500, cost: 100, profit: 800 })
  })
})

describe('stock reports', () => {
  it('stock value uses lot cost for lot items and item cost otherwise; skips untracked and inactive', () => {
    const { db, A, L } = seed()
    const dead = must(createItem(db, { name: 'Dead', baseUnit: 'pc', salePrice: 10, costPrice: 5, openingStock: { qty: 50 } })).id
    deactivateItem(db, dead)
    const r = getStockValue(db)
    const by = Object.fromEntries(r.rows.map((x) => [x.name, x]))
    // A: 1000 opening + 10 purchased - 10 sold + 3 returned = 1003 x 300
    expect(by.A).toMatchObject({ itemId: A, qty: 1003, value: 1003 * 300 })
    expect(by.L).toMatchObject({ itemId: L, qty: 96, value: 96 * 250 })
    expect(by.B).toBeUndefined()
    expect(by.Dead).toBeUndefined()
    expect(r.totalValue).toBe(1003 * 300 + 96 * 250)
  })

  it('low stock lists active tracked items at or under the reorder level', () => {
    const { db } = seed()
    must(createItem(db, { name: 'Low', baseUnit: 'pc', salePrice: 10, costPrice: 5, reorderLevel: 5, openingStock: { qty: 5 } }))
    must(createItem(db, { name: 'Fine', baseUnit: 'pc', salePrice: 10, costPrice: 5, reorderLevel: 5, openingStock: { qty: 6 } }))
    must(createItem(db, { name: 'Untracked', baseUnit: 'pc', salePrice: 10, costPrice: 5, reorderLevel: 5, trackStock: false }))
    const names = getLowStock(db).map((x) => x.name)
    expect(names).toEqual(['Low'])
  })
})

describe('balances', () => {
  it('receivables: only customers who owe, after the khata share of the return', () => {
    const { db } = seed()
    const r = getReceivables(db)
    // Ali: 3000 credit sale, then 1500 refund hits his khata first. Bilal paid in full -> not listed.
    expect(r.rows.map((x) => [x.name, x.amount])).toEqual([['Ali', 1500]])
    expect(r.total).toBe(1500)
  })

  it('payables: only suppliers the shop owes, shown positive', () => {
    const { db } = seed()
    const r = getPayables(db)
    // Hamid: 100 x 250 = 25000, paid 5000 -> 20000. Zain: 10 x 300 = 3000 fully paid.
    expect(r.rows.map((x) => [x.name, x.amount])).toEqual([['Hamid', 20000]])
    expect(r.total).toBe(20000)
  })
})
