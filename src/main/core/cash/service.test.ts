import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import { createUser } from '../users/service'
import { createParty } from '../parties/service'
import { createItem } from '../items/service'
import { createPurchase } from '../purchases/service'
import { recordPayment } from '../ledger/service'
import { completeSale, holdSale, returnSale, voidSale } from '../sales/service'
import { resetApprovalLocksForTest } from '../sales/approval'
import { addCashEntry, closeShift, getOpenShift, getShiftDetail, openShift } from './service'
import { getZReport } from './zreport'

type Db = ReturnType<typeof createTestDb>

function setup() {
  const db = createTestDb()
  const mk = (username: string, role: 'cashier' | 'manager' | 'owner') =>
    (createUser(db, { name: username, username, pin: '1234', role }) as unknown as { id: number }).id
  const cashier = mk('cash', 'cashier')
  const manager = mk('mgr', 'manager')
  const sup = createParty(db, { type: 'supplier', name: 'Hamid' })
  const cus = createParty(db, { type: 'customer', name: 'Ali' })
  if (!sup.ok || !cus.ok) throw new Error('party')
  const it = createItem(db, { name: 'Panadol', baseUnit: 'tablet', salePrice: 500, costPrice: 300, openingStock: { qty: 1000 } })
  if (!it.ok) throw new Error('item')
  return { db, cashier, manager, supplierId: sup.data.id, customerId: cus.data.id, itemId: it.data.id }
}

function open(db: Db, userId: number, openingCash = 100000) {
  const r = openShift(db, { openingCash }, userId)
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}

function sell(db: Db, userId: number, itemId: number, qty: number, extra: { paidCash?: number; paidCredit?: number; partyId?: number } = {}) {
  const total = qty * 500
  const credit = extra.paidCredit ?? 0
  const r = completeSale(db, { lines: [{ itemId, qty }], paidCash: extra.paidCash ?? total - credit, paidCredit: credit, partyId: extra.partyId }, userId)
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}

beforeEach(() => resetApprovalLocksForTest())

describe('shifts', () => {
  it('opens a shift and finds it as the current one', () => {
    const { db, cashier } = setup()
    expect(getOpenShift(db)).toBeNull()
    const s = open(db, cashier, 5000)
    expect(getOpenShift(db)?.id).toBe(s.id)
    expect(s.openingCash).toBe(5000)
  })

  it('cannot open two shifts at once', () => {
    const { db, cashier, manager } = setup()
    open(db, cashier)
    const second = openShift(db, { openingCash: 0 }, manager)
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error.code).toBe('SHIFT_ALREADY_OPEN')
    // The database itself also refuses (unique index), not just the service check.
    expect(() => db.prepare("INSERT INTO cash_shifts (user_id, opened_at, opening_cash) VALUES (1, 'x', 0)").run()).toThrow()
  })

  it('can open a new shift after the old one is closed', () => {
    const { db, cashier } = setup()
    const s = open(db, cashier)
    expect(closeShift(db, { shiftId: s.id, countedCash: 100000 }, cashier).ok).toBe(true)
    expect(openShift(db, { openingCash: 0 }, cashier).ok).toBe(true)
  })

  it('rejects negative or fractional opening cash', () => {
    const { db, cashier } = setup()
    expect(openShift(db, { openingCash: -1 }, cashier).ok).toBe(false)
    expect(openShift(db, { openingCash: 1.5 }, cashier).ok).toBe(false)
  })
})

describe('sales and shift_id', () => {
  it('refuses a sale with no open shift and leaves nothing behind', () => {
    const { db, cashier, itemId } = setup()
    const r = completeSale(db, { lines: [{ itemId, qty: 1 }], paidCash: 500, paidCredit: 0 }, cashier)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('NO_OPEN_SHIFT')
    expect((db.prepare('SELECT COUNT(*) AS n FROM sales').get() as { n: number }).n).toBe(0)
    expect(db.prepare("SELECT value FROM settings WHERE key = 'next_invoice_no'").get()).toBeUndefined()
  })

  it('stores the open shift id on the sale, also when completing a held bill', () => {
    const { db, cashier, itemId } = setup()
    const shift = open(db, cashier)
    const a = sell(db, cashier, itemId, 1)
    expect((db.prepare('SELECT shift_id FROM sales WHERE id = ?').get(a.sale.id) as { shift_id: number }).shift_id).toBe(shift.id)

    const held = holdSale(db, { lines: [{ itemId, qty: 2 }] }, cashier)
    if (!held.ok) throw new Error('hold')
    expect((db.prepare('SELECT shift_id FROM sales WHERE id = ?').get(held.data.id) as { shift_id: number | null }).shift_id).toBeNull()
    const done = completeSale(db, { lines: [{ itemId, qty: 2 }], paidCash: 1000, paidCredit: 0, heldSaleId: held.data.id }, cashier)
    expect(done.ok).toBe(true)
    expect((db.prepare('SELECT shift_id FROM sales WHERE id = ?').get(held.data.id) as { shift_id: number }).shift_id).toBe(shift.id)
  })

  it('a held bill can be saved with no shift', () => {
    const { db, cashier, itemId } = setup()
    expect(holdSale(db, { lines: [{ itemId, qty: 1 }] }, cashier).ok).toBe(true)
  })
})

describe('expected cash', () => {
  it('= opening + cash sales + cash in - cash out - expenses (change is not counted)', () => {
    const { db, cashier, itemId } = setup()
    const shift = open(db, cashier, 100000)
    sell(db, cashier, itemId, 4, { paidCash: 5000 }) // bill 2000, customer gave 5000, change 3000
    sell(db, cashier, itemId, 2) // 1000
    for (const [type, amount, note] of [['in', 20000, null], ['out', 7000, 'to owner'], ['expense', 1500, 'tea']] as const) {
      expect(addCashEntry(db, { shiftId: shift.id, type, amount, note }, cashier).ok).toBe(true)
    }
    const d = getShiftDetail(db, shift.id)
    if (!d.ok) throw new Error('detail')
    expect(d.data.cash.cashSales).toBe(3000)
    expect(d.data.cash.expectedCash).toBe(100000 + 3000 + 20000 - 7000 - 1500)
  })

  it('credit part of a sale is not cash', () => {
    const { db, cashier, itemId, customerId } = setup()
    const shift = open(db, cashier, 0)
    sell(db, cashier, itemId, 10, { paidCredit: 3000, partyId: customerId }) // 5000 total: 2000 cash, 3000 khata
    const d = getShiftDetail(db, shift.id)
    if (!d.ok) throw new Error('detail')
    expect(d.data.cash.expectedCash).toBe(2000)
  })

  it('cash refunds, same-shift void, cash purchase and khata payments move the drawer', () => {
    const { db, cashier, manager, itemId, supplierId, customerId } = setup()
    const shift = open(db, cashier, 100000)
    const s1 = sell(db, cashier, itemId, 4) // +2000
    const s2 = sell(db, cashier, itemId, 2) // +1000, voided below -> nets to 0
    const line = s1.sale.lines[0]
    const ret = returnSale(db, { saleId: s1.sale.id, lines: [{ saleLineId: line.id, qtyBase: 1 }], refundTo: 'cash' }, { id: manager, role: 'manager' })
    expect(ret.ok).toBe(true) // -500
    const v = voidSale(db, { saleId: s2.sale.id, reason: 'wrong', approval: { userId: manager, pin: '1234' } }, cashier)
    expect(v.ok).toBe(true)
    const p = createPurchase(db, {
      supplierId, lines: [{ itemId, qty: 10, unitCost: 300 }], paid: 1200
    }, cashier)
    expect(p.ok).toBe(true) // -1200
    expect(recordPayment(db, { partyId: customerId, amount: 700 }, cashier).ok).toBe(true) // +700
    expect(recordPayment(db, { partyId: supplierId, amount: 400 }, cashier).ok).toBe(true) // -400
    const d = getShiftDetail(db, shift.id)
    if (!d.ok) throw new Error('detail')
    expect(d.data.cash.expectedCash).toBe(100000 + 2000 + 1000 - (500 + 1000) - 1200 + 700 - 400)
  })

  it('close stores expected, counted and the difference', () => {
    const { db, cashier, itemId } = setup()
    const shift = open(db, cashier, 10000)
    sell(db, cashier, itemId, 2)
    const res = closeShift(db, { shiftId: shift.id, countedCash: 10900, note: 'short 100' }, cashier)
    if (!res.ok) throw new Error(res.error.message)
    expect(res.data.shift.expectedCash).toBe(11000)
    expect(res.data.shift.countedCash).toBe(10900)
    expect(res.data.shift.difference).toBe(-100)
    expect(res.data.shift.closedAt).not.toBeNull()
    expect(getOpenShift(db)).toBeNull()
  })

  it('a refund after the shift was closed is not tracked in the closed shift', () => {
    const { db, cashier, manager, itemId } = setup()
    const shift = open(db, cashier, 0)
    const s = sell(db, cashier, itemId, 2)
    closeShift(db, { shiftId: shift.id, countedCash: 1000 }, cashier)
    returnSale(db, { saleId: s.sale.id, lines: [{ saleLineId: s.sale.lines[0].id, qtyBase: 1 }], refundTo: 'cash' }, { id: manager, role: 'manager' })
    const d = getShiftDetail(db, shift.id)
    if (!d.ok) throw new Error('detail')
    expect(d.data.cash.expectedCash).toBe(1000)
  })
})

describe('closed shifts', () => {
  it('cannot add cash entries to a closed shift, nor close it twice', () => {
    const { db, cashier } = setup()
    const shift = open(db, cashier)
    closeShift(db, { shiftId: shift.id, countedCash: 100000 }, cashier)
    const r = addCashEntry(db, { shiftId: shift.id, type: 'in', amount: 100 }, cashier)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('SHIFT_CLOSED')
    expect(closeShift(db, { shiftId: shift.id, countedCash: 1 }, cashier).ok).toBe(false)
  })

  it('needs a note for cash out / expense, and an amount above zero', () => {
    const { db, cashier } = setup()
    const shift = open(db, cashier)
    expect(addCashEntry(db, { shiftId: shift.id, type: 'expense', amount: 100 }, cashier).ok).toBe(false)
    expect(addCashEntry(db, { shiftId: shift.id, type: 'out', amount: 100, note: '  ' }, cashier).ok).toBe(false)
    expect(addCashEntry(db, { shiftId: shift.id, type: 'in', amount: 0 }, cashier).ok).toBe(false)
    expect(addCashEntry(db, { shiftId: shift.id, type: 'in', amount: 100 }, cashier).ok).toBe(true)
  })
})

describe('Z report', () => {
  it('totals by payment type, discounts, returns, voids, expenses and difference', () => {
    const { db, cashier, manager, itemId, customerId } = setup()
    const shift = open(db, cashier, 10000)
    sell(db, cashier, itemId, 4) // 2000 cash
    const credit = sell(db, cashier, itemId, 10, { paidCredit: 3000, partyId: customerId }) // 5000: 2000 cash + 3000 khata
    const disc = completeSale(db, { lines: [{ itemId, qty: 2 }], billDiscount: 200, paidCash: 800, paidCredit: 0 }, cashier) // 1000-200
    expect(disc.ok).toBe(true)
    const gone = sell(db, cashier, itemId, 2)
    voidSale(db, { saleId: gone.sale.id, reason: 'oops', approval: { userId: manager, pin: '1234' } }, cashier)
    returnSale(db, { saleId: credit.sale.id, lines: [{ saleLineId: credit.sale.lines[0].id, qtyBase: 1 }], refundTo: 'credit' }, { id: manager, role: 'manager' }) // 500 on khata
    addCashEntry(db, { shiftId: shift.id, type: 'expense', amount: 300, note: 'tea' }, cashier)
    closeShift(db, { shiftId: shift.id, countedCash: 14500 }, cashier)

    const z = getZReport(db, shift.id)
    if (!z.ok) throw new Error('z')
    expect(z.data.sales).toEqual({ count: 3, subtotal: 2000 + 5000 + 1000, discount: 200, total: 2000 + 5000 + 800 })
    expect(z.data.byPayment).toEqual({ cash: 2000 + 2000 + 800, credit: 3000 })
    expect(z.data.returns).toEqual({ count: 1, total: 500, cash: 0, credit: 500 })
    expect(z.data.voids).toEqual({ count: 1, total: 1000 })
    expect(z.data.cash.expenses).toBe(300)
    // 10000 + (2000+2000+800+1000 sold) - 1000 voided - 300 expense
    expect(z.data.cash.expectedCash).toBe(14500)
    expect(z.data.shift.difference).toBe(0)
  })

  it('works on an open shift and errors on an unknown one', () => {
    const { db, cashier } = setup()
    const shift = open(db, cashier)
    const z = getZReport(db, shift.id)
    expect(z.ok && z.data.shift.closedAt).toBeNull()
    expect(getZReport(db, 999).ok).toBe(false)
  })
})
