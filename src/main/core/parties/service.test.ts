import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import { getBalance } from '../ledger/service'
import {
  createParty,
  updateParty,
  getPartyById,
  listParties,
  deactivateParty,
  reactivateParty
} from './service'

function mustCreate(db: ReturnType<typeof createTestDb>, input: Parameters<typeof createParty>[1]) {
  const res = createParty(db, input)
  if (!res.ok) throw new Error(res.error.message)
  return res.data
}

describe('Parties service', () => {
  it('creates a customer with an opening balance posted as a debit', () => {
    const db = createTestDb()
    const c = mustCreate(db, { type: 'customer', name: ' Ali Khan ', phone: '0300', creditLimit: 500000, openingBalance: 150000 })
    expect(c.name).toBe('Ali Khan')
    expect(c.balance).toBe(150000)
    expect(c.creditLimit).toBe(500000)

    const rows = db.prepare('SELECT * FROM party_ledger WHERE party_id = ?').all(c.id) as Array<{ type: string; debit: number; credit: number }>
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'opening', debit: 150000, credit: 0 })
  })

  it('creates a supplier with an opening balance posted as a credit (shop owes) and ignores credit limit', () => {
    const db = createTestDb()
    const s = mustCreate(db, { type: 'supplier', name: 'Hamid Traders', creditLimit: 999, openingBalance: 700000 })
    expect(s.balance).toBe(-700000)
    expect(s.creditLimit).toBe(0)
    const row = db.prepare('SELECT debit, credit FROM party_ledger WHERE party_id = ?').get(s.id) as { debit: number; credit: number }
    expect(row).toEqual({ debit: 0, credit: 700000 })
  })

  it('posts no ledger row without an opening balance', () => {
    const db = createTestDb()
    const c = mustCreate(db, { type: 'customer', name: 'Zero' })
    expect(c.balance).toBe(0)
    expect(db.prepare('SELECT COUNT(*) AS n FROM party_ledger').get()).toEqual({ n: 0 })
  })

  it('rejects empty name, negative or fractional amounts, and duplicate active names', () => {
    const db = createTestDb()
    expect(createParty(db, { type: 'customer', name: '   ' })).toMatchObject({ ok: false, error: { code: 'INVALID_NAME' } })
    expect(createParty(db, { type: 'customer', name: 'A', openingBalance: -5 })).toMatchObject({ ok: false, error: { code: 'INVALID_AMOUNT' } })
    expect(createParty(db, { type: 'customer', name: 'A', creditLimit: 1.5 })).toMatchObject({ ok: false, error: { code: 'INVALID_AMOUNT' } })
    mustCreate(db, { type: 'customer', name: 'Bilal' })
    expect(createParty(db, { type: 'customer', name: 'bilal' })).toMatchObject({ ok: false, error: { code: 'PARTY_EXISTS' } })
    // Same name is fine for the other party type
    expect(createParty(db, { type: 'supplier', name: 'Bilal' }).ok).toBe(true)
  })

  it('writes an audit row on create including the opening balance', () => {
    const db = createTestDb()
    const c = mustCreate(db, { type: 'customer', name: 'Audit Me', openingBalance: 1000 })
    const row = db.prepare("SELECT * FROM audit_log WHERE action = 'party_create' AND entity_id = ?").get(c.id) as { details: string }
    expect(JSON.parse(row.details).openingBalance).toBe(1000)
  })

  it('updates details but never changes the balance or type', () => {
    const db = createTestDb()
    const c = mustCreate(db, { type: 'customer', name: 'Old', openingBalance: 5000, creditLimit: 100 })
    const res = updateParty(db, { id: c.id, name: 'New', phone: '111', creditLimit: 9000 })
    expect(res.ok).toBe(true)
    const after = getPartyById(db, c.id)!
    expect(after).toMatchObject({ name: 'New', phone: '111', creditLimit: 9000, balance: 5000, type: 'customer' })
    // omitted credit limit keeps the stored value
    updateParty(db, { id: c.id, name: 'New' })
    expect(getPartyById(db, c.id)!.creditLimit).toBe(9000)
    expect(updateParty(db, { id: 999, name: 'x' })).toMatchObject({ ok: false, error: { code: 'PARTY_NOT_FOUND' } })
  })

  it('lists by type, searches by name/phone (escaping LIKE chars) and paginates', () => {
    const db = createTestDb()
    mustCreate(db, { type: 'customer', name: 'Ahmed', phone: '0301' })
    mustCreate(db, { type: 'customer', name: 'Ahmad 100%', phone: '0302' })
    mustCreate(db, { type: 'customer', name: 'Zubair' })
    mustCreate(db, { type: 'supplier', name: 'Ahmed Wholesale' })

    expect(listParties(db, { type: 'customer' }).total).toBe(3)
    expect(listParties(db, { type: 'supplier' }).parties).toHaveLength(1)
    expect(listParties(db, { type: 'customer', query: 'ahm' }).total).toBe(2)
    expect(listParties(db, { type: 'customer', query: '0302' }).parties[0].name).toBe('Ahmad 100%')
    expect(listParties(db, { type: 'customer', query: '100%' }).total).toBe(1)
    expect(listParties(db, { type: 'customer', query: '%' }).total).toBe(1)
    const p2 = listParties(db, { type: 'customer', page: 2, pageSize: 2 })
    expect(p2.parties).toHaveLength(1)
    expect(p2.total).toBe(3)
  })

  it('deactivates and reactivates without deleting ledger history', () => {
    const db = createTestDb()
    const c = mustCreate(db, { type: 'customer', name: 'Keep', openingBalance: 2500 })
    expect(deactivateParty(db, c.id, null).ok).toBe(true)
    expect(listParties(db, { type: 'customer', activeOnly: true }).total).toBe(0)
    expect(getBalance(db, c.id)).toBe(2500)
    // name can be reused while inactive, so reactivating then conflicts
    mustCreate(db, { type: 'customer', name: 'Keep' })
    expect(reactivateParty(db, c.id, null)).toMatchObject({ ok: false, error: { code: 'PARTY_EXISTS' } })
    expect(deactivateParty(db, 999)).toMatchObject({ ok: false })
  })
})
