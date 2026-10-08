import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import { createUser } from '../users/service'
import { createParty } from '../parties/service'
import { createItem } from '../items/service'
import { createPurchase } from '../purchases/service'
import { getBalance } from '../ledger/service'
import { openShift } from '../cash/service'
import { getItemStock, getLotStock } from '../stock/service'
import { completeSale, getSale, returnSale, voidSale } from './service'
import { resetApprovalLocksForTest } from './approval'

type Db = ReturnType<typeof createTestDb>

function setup() {
  const db = createTestDb()
  const mk = (username: string, role: 'cashier' | 'manager' | 'owner') =>
    (createUser(db, { name: username, username, pin: '1234', role }) as unknown as { id: number }).id
  const cashier = mk('cash', 'cashier')
  const manager = mk('mgr', 'manager')
  openShift(db, { openingCash: 0 }, cashier)
  const sup = createParty(db, { type: 'supplier', name: 'Hamid' })
  const cus = createParty(db, { type: 'customer', name: 'Ali' })
  if (!sup.ok || !cus.ok) throw new Error('party')
  return { db, cashier, manager, supplierId: sup.data.id, customerId: cus.data.id }
}

let n = 0
function item(db: Db, extra: Partial<Parameters<typeof createItem>[1]> = {}): number {
  const res = createItem(db, {
    name: `Item ${++n}`, baseUnit: 'tablet', salePrice: 500, costPrice: 300,
    units: [{ name: 'Box', factor: 10 }], openingStock: { qty: 1000 }, ...extra
  })
  if (!res.ok) throw new Error(res.error.message)
  return res.data.id
}

function sellOk(db: Db, userId: number, input: Parameters<typeof completeSale>[1]) {
  const r = completeSale(db, input, userId)
  if (!r.ok) throw new Error(r.error.message)
  return r.data.sale
}

beforeEach(() => { n = 0; resetApprovalLocksForTest() })

describe('returnSale', () => {
  it('returns stock, refunds cash, caps at sold minus returned, shares bill discount', () => {
    const { db, cashier, manager } = setup()
    const a = item(db)
    const sale = sellOk(db, cashier, { lines: [{ itemId: a, qty: 10 }], billDiscount: 100, paidCash: 4900, paidCredit: 0 })
    expect(sale.total).toBe(4900)
    const lineId = sale.lines[0].id
    const user = { id: manager, role: 'manager' as const }

    const r1 = returnSale(db, { saleId: sale.id, lines: [{ saleLineId: lineId, qtyBase: 3 }] }, user)
    expect(r1).toMatchObject({ ok: true, data: { total: 1470, refundCash: 1470, refundCredit: 0 } })
    expect(getItemStock(db, a)).toBe(1000 - 10 + 3)

    const tooMuch = returnSale(db, { saleId: sale.id, lines: [{ saleLineId: lineId, qtyBase: 8 }] }, user)
    expect(tooMuch).toMatchObject({ ok: false, error: { code: 'RETURN_TOO_MUCH' } })
    expect(getItemStock(db, a)).toBe(993)

    // Last 7 refund the exact remainder: 4900 - 1470.
    const r2 = returnSale(db, { saleId: sale.id, lines: [{ saleLineId: lineId, qtyBase: 7 }] }, user)
    expect(r2).toMatchObject({ ok: true, data: { total: 3430 } })
    expect(getSale(db, sale.id)!.returnedTotal).toBe(4900)
    expect(getSale(db, sale.id)!.lines[0].returnedBase).toBe(10)
    expect(getItemStock(db, a)).toBe(1000)
  })

  it('credit sale: auto refund reduces the customer balance first, then cash', () => {
    const { db, cashier, manager, customerId } = setup()
    const a = item(db)
    const sale = sellOk(db, cashier, {
      partyId: customerId, lines: [{ itemId: a, qty: 10 }], paidCash: 2000, paidCredit: 3000
    })
    expect(getBalance(db, customerId)).toBe(3000)
    const user = { id: manager, role: 'manager' as const }
    const line = sale.lines[0].id
    const r1 = returnSale(db, { saleId: sale.id, lines: [{ saleLineId: line, qtyBase: 4 }] }, user) // 2000
    expect(r1).toMatchObject({ ok: true, data: { refundCredit: 2000, refundCash: 0 } })
    expect(getBalance(db, customerId)).toBe(1000)
    const r2 = returnSale(db, { saleId: sale.id, lines: [{ saleLineId: line, qtyBase: 6 }] }, user) // 3000
    expect(r2).toMatchObject({ ok: true, data: { refundCredit: 1000, refundCash: 2000 } })
    expect(getBalance(db, customerId)).toBe(0)
  })

  it('explicit refund modes: cash blocked on credit sale, credit needs a customer', () => {
    const { db, cashier, manager, customerId } = setup()
    const a = item(db)
    const user = { id: manager, role: 'manager' as const }
    const creditSale = sellOk(db, cashier, { partyId: customerId, lines: [{ itemId: a, qty: 2 }], paidCash: 0, paidCredit: 1000 })
    expect(returnSale(db, { saleId: creditSale.id, refundTo: 'cash', lines: [{ saleLineId: creditSale.lines[0].id, qtyBase: 1 }] }, user))
      .toMatchObject({ ok: false, error: { code: 'REFUND_NOT_CASH' } })
    const cashSale = sellOk(db, cashier, { lines: [{ itemId: a, qty: 2 }], paidCash: 1000, paidCredit: 0 })
    expect(returnSale(db, { saleId: cashSale.id, refundTo: 'credit', lines: [{ saleLineId: cashSale.lines[0].id, qtyBase: 1 }] }, user))
      .toMatchObject({ ok: false, error: { code: 'CUSTOMER_REQUIRED' } })
    // failed returns left stock and ledger alone
    expect(getItemStock(db, a)).toBe(996)
    expect(getBalance(db, customerId)).toBe(1000)
    // cash sale to a known customer can be refunded to their account
    const named = sellOk(db, cashier, { partyId: customerId, lines: [{ itemId: a, qty: 2 }], paidCash: 1000, paidCredit: 0 })
    returnSale(db, { saleId: named.id, refundTo: 'credit', lines: [{ saleLineId: named.lines[0].id, qtyBase: 2 }] }, user)
    expect(getBalance(db, customerId)).toBe(0)
  })

  it('stock goes back to the same lots', () => {
    const { db, cashier, manager, supplierId } = setup()
    const a = item(db, { trackLots: true, openingStock: undefined, units: [] })
    for (const [lotNo, qty] of [['L1', 10], ['L2', 20]] as const) {
      createPurchase(db, { supplierId, lines: [{ itemId: a, qty, unitCost: 300, lotNo, expiryDate: '2030-01-31' }] }, manager)
    }
    const lots = db.prepare('SELECT id FROM stock_lots ORDER BY id').all() as Array<{ id: number }>
    const sale = sellOk(db, cashier, { lines: [{ itemId: a, qty: 15 }], paidCash: 7500, paidCredit: 0 })
    expect([getLotStock(db, lots[0].id), getLotStock(db, lots[1].id)]).toEqual([0, 15])
    // Return 7: oldest chunk first -> 7 back to L1.
    returnSale(db, { saleId: sale.id, lines: [{ saleLineId: sale.lines[0].id, qtyBase: 7 }] }, { id: manager, role: 'manager' })
    expect([getLotStock(db, lots[0].id), getLotStock(db, lots[1].id)]).toEqual([7, 15])
    // Return the other 8: 3 fill L1, 5 go to L2.
    returnSale(db, { saleId: sale.id, lines: [{ saleLineId: sale.lines[0].id, qtyBase: 8 }] }, { id: manager, role: 'manager' })
    expect([getLotStock(db, lots[0].id), getLotStock(db, lots[1].id)]).toEqual([10, 20])
  })

  it('cashier needs a manager PIN; wrong PIN is refused and locks after 5 tries', () => {
    const { db, cashier, manager } = setup()
    const a = item(db)
    const sale = sellOk(db, cashier, { lines: [{ itemId: a, qty: 2 }], paidCash: 1000, paidCredit: 0 })
    const lines = [{ saleLineId: sale.lines[0].id, qtyBase: 1 }]
    const me = { id: cashier, role: 'cashier' as const }
    expect(returnSale(db, { saleId: sale.id, lines }, me)).toMatchObject({ ok: false, error: { code: 'APPROVAL_REQUIRED' } })
    expect(returnSale(db, { saleId: sale.id, lines, approval: { userId: cashier, pin: '1234' } }, me))
      .toMatchObject({ ok: false, error: { code: 'INVALID_APPROVAL' } }) // cashier cannot approve
    expect(returnSale(db, { saleId: sale.id, lines, approval: { userId: manager, pin: '9999' } }, me))
      .toMatchObject({ ok: false, error: { code: 'INVALID_APPROVAL' } })
    expect(returnSale(db, { saleId: sale.id, lines, approval: { userId: manager, pin: '1234' } }, me).ok).toBe(true)
    for (let i = 0; i < 5; i++) returnSale(db, { saleId: sale.id, lines, approval: { userId: manager, pin: '0000' } }, me)
    expect(returnSale(db, { saleId: sale.id, lines, approval: { userId: manager, pin: '1234' } }, me))
      .toMatchObject({ ok: false, error: { code: 'LOCKED' } })
  })

  it('refuses unknown lines, duplicate lines and void sales', () => {
    const { db, cashier, manager } = setup()
    const a = item(db)
    const sale = sellOk(db, cashier, { lines: [{ itemId: a, qty: 2 }], paidCash: 1000, paidCredit: 0 })
    const user = { id: manager, role: 'manager' as const }
    const id = sale.lines[0].id
    expect(returnSale(db, { saleId: sale.id, lines: [{ saleLineId: 99999, qtyBase: 1 }] }, user)).toMatchObject({ ok: false, error: { code: 'LINE_NOT_FOUND' } })
    expect(returnSale(db, { saleId: sale.id, lines: [{ saleLineId: id, qtyBase: 1 }, { saleLineId: id, qtyBase: 1 }] }, user)).toMatchObject({ ok: false, error: { code: 'DUPLICATE_LINE' } })
    voidSale(db, { saleId: sale.id, reason: 'x', approval: { userId: manager, pin: '1234' } }, manager)
    expect(returnSale(db, { saleId: sale.id, lines: [{ saleLineId: id, qtyBase: 1 }] }, user)).toMatchObject({ ok: false, error: { code: 'SALE_VOID' } })
  })
})

describe('voidSale', () => {
  it('reverses stock and khata, marks void, audits; cannot void twice', () => {
    const { db, cashier, manager, customerId } = setup()
    const a = item(db)
    const sale = sellOk(db, cashier, { partyId: customerId, lines: [{ itemId: a, qty: 10 }], paidCash: 2000, paidCredit: 3000 })
    expect(getItemStock(db, a)).toBe(990)
    expect(getBalance(db, customerId)).toBe(3000)

    const res = voidSale(db, { saleId: sale.id, reason: 'wrong customer', approval: { userId: manager, pin: '1234' } }, cashier)
    expect(res.ok).toBe(true)
    expect(getItemStock(db, a)).toBe(1000)
    expect(getBalance(db, customerId)).toBe(0)
    const v = getSale(db, sale.id)!
    expect(v.status).toBe('void')
    expect(v.voidReason).toBe('wrong customer')
    expect(v.invoiceNo).toBe(sale.invoiceNo) // number is kept, never reused
    const audit = db.prepare("SELECT details FROM audit_log WHERE action = 'sale_voided'").get() as { details: string }
    expect(JSON.parse(audit.details)).toMatchObject({ approvedBy: manager })
    expect(voidSale(db, { saleId: sale.id, reason: 'again', approval: { userId: manager, pin: '1234' } }, cashier))
      .toMatchObject({ ok: false, error: { code: 'SALE_VOID' } })
  })

  it('needs a manager/owner PIN and a reason; nothing changes on failure', () => {
    const { db, cashier, manager } = setup()
    const a = item(db)
    const sale = sellOk(db, cashier, { lines: [{ itemId: a, qty: 2 }], paidCash: 1000, paidCredit: 0 })
    expect(voidSale(db, { saleId: sale.id, reason: 'x', approval: { userId: manager, pin: '1111' } }, cashier)).toMatchObject({ ok: false, error: { code: 'INVALID_APPROVAL' } })
    expect(voidSale(db, { saleId: sale.id, reason: 'x', approval: { userId: cashier, pin: '1234' } }, cashier)).toMatchObject({ ok: false, error: { code: 'INVALID_APPROVAL' } })
    expect(voidSale(db, { saleId: sale.id, reason: '  ', approval: { userId: manager, pin: '1234' } }, cashier)).toMatchObject({ ok: false, error: { code: 'REASON_REQUIRED' } })
    expect(getSale(db, sale.id)!.status).toBe('completed')
    expect(getItemStock(db, a)).toBe(998)
  })

  it('cannot void after a return; lot stock is restored to the same lots', () => {
    const { db, cashier, manager, supplierId } = setup()
    const a = item(db, { trackLots: true, openingStock: undefined, units: [] })
    for (const [lotNo, qty] of [['L1', 10], ['L2', 20]] as const) {
      createPurchase(db, { supplierId, lines: [{ itemId: a, qty, unitCost: 300, lotNo, expiryDate: '2030-01-31' }] }, manager)
    }
    const lots = db.prepare('SELECT id FROM stock_lots ORDER BY id').all() as Array<{ id: number }>
    const s1 = sellOk(db, cashier, { lines: [{ itemId: a, qty: 15 }], paidCash: 7500, paidCredit: 0 })
    voidSale(db, { saleId: s1.id, reason: 'oops', approval: { userId: manager, pin: '1234' } }, cashier)
    expect([getLotStock(db, lots[0].id), getLotStock(db, lots[1].id)]).toEqual([10, 20])

    const s2 = sellOk(db, cashier, { lines: [{ itemId: a, qty: 2 }], paidCash: 1000, paidCredit: 0 })
    returnSale(db, { saleId: s2.id, lines: [{ saleLineId: s2.lines[0].id, qtyBase: 1 }] }, { id: manager, role: 'manager' })
    expect(voidSale(db, { saleId: s2.id, reason: 'x', approval: { userId: manager, pin: '1234' } }, cashier))
      .toMatchObject({ ok: false, error: { code: 'HAS_RETURNS' } })
  })
})
