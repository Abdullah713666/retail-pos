import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import { createParty } from '../parties/service'
import { postEntry, getBalance, getStatement, recordPayment } from './service'

type Db = ReturnType<typeof createTestDb>

function party(db: Db, type: 'customer' | 'supplier', name: string, openingBalance?: number): number {
  const res = createParty(db, { type, name, openingBalance })
  if (!res.ok) throw new Error(res.error.message)
  return res.data.id
}

describe('Ledger service', () => {
  it('computes balance as debit - credit (customer owes = positive)', () => {
    const db = createTestDb()
    const c = party(db, 'customer', 'Ali', 10000)
    postEntry(db, { partyId: c, type: 'sale', debit: 25000 })
    postEntry(db, { partyId: c, type: 'payment_in', credit: 15000 })
    expect(getBalance(db, c)).toBe(20000)
  })

  it('supplier purchases make the balance negative (shop owes)', () => {
    const db = createTestDb()
    const s = party(db, 'supplier', 'Hamid', 50000)
    postEntry(db, { partyId: s, type: 'purchase', credit: 30000 })
    postEntry(db, { partyId: s, type: 'payment_out', debit: 40000 })
    expect(getBalance(db, s)).toBe(-40000)
  })

  it('rejects bad amounts, wrong side, wrong party type, unknown party and bad dates', () => {
    const db = createTestDb()
    const c = party(db, 'customer', 'Ali')
    const s = party(db, 'supplier', 'Hamid')
    expect(postEntry(db, { partyId: c, type: 'sale' })).toMatchObject({ ok: false, error: { code: 'INVALID_AMOUNT' } })
    expect(postEntry(db, { partyId: c, type: 'sale', debit: 5, credit: 5 })).toMatchObject({ ok: false, error: { code: 'INVALID_AMOUNT' } })
    expect(postEntry(db, { partyId: c, type: 'sale', debit: -5 })).toMatchObject({ ok: false, error: { code: 'INVALID_AMOUNT' } })
    expect(postEntry(db, { partyId: c, type: 'sale', debit: 1.5 })).toMatchObject({ ok: false, error: { code: 'INVALID_AMOUNT' } })
    expect(postEntry(db, { partyId: c, type: 'sale', credit: 5 })).toMatchObject({ ok: false, error: { code: 'WRONG_SIDE' } })
    expect(postEntry(db, { partyId: s, type: 'sale', debit: 5 })).toMatchObject({ ok: false, error: { code: 'WRONG_PARTY_TYPE' } })
    expect(postEntry(db, { partyId: c, type: 'purchase', credit: 5 })).toMatchObject({ ok: false, error: { code: 'WRONG_PARTY_TYPE' } })
    expect(postEntry(db, { partyId: 999, type: 'adjust', debit: 5 })).toMatchObject({ ok: false, error: { code: 'PARTY_NOT_FOUND' } })
    expect(postEntry(db, { partyId: c, type: 'adjust', debit: 5, createdAt: '2026-1-1' })).toMatchObject({ ok: false, error: { code: 'INVALID_DATE' } })
    expect(db.prepare('SELECT COUNT(*) AS n FROM party_ledger').get()).toEqual({ n: 0 })
  })

  it('refuses sales/purchases for deactivated parties but still allows payments', () => {
    const db = createTestDb()
    const c = party(db, 'customer', 'Ali', 1000)
    db.prepare('UPDATE parties SET active = 0 WHERE id = ?').run(c)
    expect(postEntry(db, { partyId: c, type: 'sale', debit: 5 })).toMatchObject({ ok: false, error: { code: 'PARTY_INACTIVE' } })
    expect(recordPayment(db, { partyId: c, amount: 1000 }, null).ok).toBe(true)
  })

  it('statement: opening balance before start date, running balance and totals', () => {
    const db = createTestDb()
    const c = party(db, 'customer', 'Ali')
    postEntry(db, { partyId: c, type: 'sale', debit: 10000, createdAt: '2026-09-28 10:00:00' })
    postEntry(db, { partyId: c, type: 'payment_in', credit: 3000, createdAt: '2026-09-30 23:59:59' })
    postEntry(db, { partyId: c, type: 'sale', debit: 5000, createdAt: '2026-10-01 00:00:00' })
    postEntry(db, { partyId: c, type: 'payment_in', credit: 2000, createdAt: '2026-10-05 12:00:00' })
    postEntry(db, { partyId: c, type: 'sale', debit: 999, createdAt: '2026-10-06 00:00:00' })

    const res = getStatement(db, { partyId: c, from: '2026-10-01', to: '2026-10-05' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const st = res.data
    expect(st.openingBalance).toBe(7000) // 10000 - 3000 before Oct 1
    expect(st.entries.map((e) => e.balance)).toEqual([12000, 10000])
    expect(st.totalDebit).toBe(5000)
    expect(st.totalCredit).toBe(2000)
    expect(st.closingBalance).toBe(10000)
    expect(st.closingBalance).toBe(st.openingBalance + st.totalDebit - st.totalCredit)
  })

  it('statement without dates covers everything and closing equals getBalance', () => {
    const db = createTestDb()
    const s = party(db, 'supplier', 'Hamid', 8000)
    postEntry(db, { partyId: s, type: 'purchase', credit: 2000 })
    recordPayment(db, { partyId: s, amount: 4500 }, null)
    const st = getStatement(db, { partyId: s })
    if (!st.ok) throw new Error('statement failed')
    expect(st.data.openingBalance).toBe(0)
    expect(st.data.entries).toHaveLength(3)
    expect(st.data.closingBalance).toBe(getBalance(db, s))
    expect(st.data.closingBalance).toBe(-5500)
  })

  it('statement orders same-second entries by id and handles open-ended ranges', () => {
    const db = createTestDb()
    const c = party(db, 'customer', 'Ali')
    const t = '2026-10-02 09:00:00'
    postEntry(db, { partyId: c, type: 'sale', debit: 100, createdAt: t })
    postEntry(db, { partyId: c, type: 'payment_in', credit: 40, createdAt: t })
    postEntry(db, { partyId: c, type: 'sale', debit: 1, createdAt: '2026-10-09 09:00:00' })
    const onlyTo = getStatement(db, { partyId: c, to: '2026-10-02' })
    if (!onlyTo.ok) throw new Error('fail')
    expect(onlyTo.data.entries.map((e) => e.balance)).toEqual([100, 60])
    const onlyFrom = getStatement(db, { partyId: c, from: '2026-10-03' })
    if (!onlyFrom.ok) throw new Error('fail')
    expect(onlyFrom.data.openingBalance).toBe(60)
    expect(onlyFrom.data.entries).toHaveLength(1)
  })

  it('statement validates dates, range and party', () => {
    const db = createTestDb()
    const c = party(db, 'customer', 'Ali')
    expect(getStatement(db, { partyId: c, from: '01-10-2026' })).toMatchObject({ ok: false, error: { code: 'INVALID_DATE' } })
    expect(getStatement(db, { partyId: c, from: '2026-10-05', to: '2026-10-01' })).toMatchObject({ ok: false, error: { code: 'INVALID_RANGE' } })
    expect(getStatement(db, { partyId: 999 })).toMatchObject({ ok: false, error: { code: 'PARTY_NOT_FOUND' } })
  })

  it('recordPayment: customer payment_in credit, supplier payment_out debit, with audit', () => {
    const db = createTestDb()
    const c = party(db, 'customer', 'Ali', 10000)
    const s = party(db, 'supplier', 'Hamid', 10000)

    const pin = recordPayment(db, { partyId: c, amount: 4000, note: ' part ' }, null)
    expect(pin.ok && pin.data).toMatchObject({ type: 'payment_in', credit: 4000, debit: 0, note: 'part', balance: 6000 })
    const pout = recordPayment(db, { partyId: s, amount: 2500 }, null)
    expect(pout.ok && pout.data).toMatchObject({ type: 'payment_out', debit: 2500, credit: 0, balance: -7500 })

    const audits = db.prepare("SELECT action FROM audit_log WHERE action IN ('payment_in','payment_out') ORDER BY id").all()
    expect(audits).toEqual([{ action: 'payment_in' }, { action: 'payment_out' }])
  })

  it('recordPayment rejects zero, negative, fractional amounts and unknown party; overpay becomes advance', () => {
    const db = createTestDb()
    const c = party(db, 'customer', 'Ali', 1000)
    for (const amount of [0, -5, 2.5]) {
      expect(recordPayment(db, { partyId: c, amount }, null)).toMatchObject({ ok: false, error: { code: 'INVALID_AMOUNT' } })
    }
    expect(recordPayment(db, { partyId: 999, amount: 5 }, null)).toMatchObject({ ok: false, error: { code: 'PARTY_NOT_FOUND' } })
    expect(getBalance(db, c)).toBe(1000)
    recordPayment(db, { partyId: c, amount: 1500 }, null)
    expect(getBalance(db, c)).toBe(-500)
  })

  it('works inside a caller transaction and rolls back with it (for sales/purchases)', () => {
    const db = createTestDb()
    const c = party(db, 'customer', 'Ali')
    const failing = db.transaction(() => {
      postEntry(db, { partyId: c, type: 'sale', debit: 9999, refType: 'sale', refId: 1 })
      recordPayment(db, { partyId: c, amount: 100 }, null) // nested -> savepoint
      throw new Error('sale failed later')
    })
    expect(() => failing()).toThrow('sale failed later')
    expect(getBalance(db, c)).toBe(0)
    expect(db.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE action = ?').get('payment_in')).toEqual({ n: 0 })

    db.transaction(() => {
      postEntry(db, { partyId: c, type: 'sale', debit: 700, refType: 'sale', refId: 2 })
    })()
    expect(getBalance(db, c)).toBe(700)
  })

  it('create party and its opening entry are atomic', () => {
    const db = createTestDb()
    db.exec('DROP TABLE audit_log') // force the last statement of createParty to fail
    expect(() => createParty(db, { type: 'customer', name: 'Big', openingBalance: 5000 })).toThrow()
    expect(db.prepare('SELECT COUNT(*) AS n FROM parties').get()).toEqual({ n: 0 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM party_ledger').get()).toEqual({ n: 0 })
  })
})
