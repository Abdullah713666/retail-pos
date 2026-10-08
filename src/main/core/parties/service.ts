import type Database from 'better-sqlite3'
import { ok, err, type Result } from '@shared/result'
import { nowLocal } from '@shared/dates'
import type {
  Party,
  PartyType,
  CreatePartyInput,
  UpdatePartyInput,
  PartyFilter,
  PartyListResult
} from '@shared/types'
import { logAudit } from '../audit/service'
import { postEntry } from '../ledger/service'

interface PartyRow {
  id: number
  type: PartyType
  name: string
  phone: string | null
  address: string | null
  credit_limit: number
  active: number
  created_at: string
  balance: number
}

// Balance is computed from the ledger (never stored on the party), see ledger/service.ts.
const SELECT_PARTY = `
  SELECT p.*,
    COALESCE((SELECT SUM(l.debit) - SUM(l.credit) FROM party_ledger l WHERE l.party_id = p.id), 0) AS balance
  FROM parties p`

function mapRow(row: PartyRow): Party {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    phone: row.phone,
    address: row.address,
    creditLimit: row.credit_limit,
    active: row.active,
    createdAt: row.created_at,
    balance: row.balance
  }
}

function escapeLike(word: string): string {
  return word.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export function getPartyById(db: Database.Database, id: number): Party | null {
  const row = db.prepare(`${SELECT_PARTY} WHERE p.id = ?`).get(id) as PartyRow | undefined
  return row ? mapRow(row) : null
}

export function listParties(db: Database.Database, filter: PartyFilter): PartyListResult {
  const page = filter.page ?? 1
  const pageSize = Math.min(filter.pageSize ?? 20, 200)
  const where: string[] = ['p.type = ?']
  const params: Array<string | number> = [filter.type]

  if (filter.activeOnly) where.push('p.active = 1')
  for (const word of (filter.query ?? '').toLowerCase().split(/\s+/).filter(Boolean)) {
    const like = `%${escapeLike(word)}%`
    where.push("(LOWER(p.name) LIKE ? ESCAPE '\\' OR COALESCE(p.phone, '') LIKE ? ESCAPE '\\')")
    params.push(like, like)
  }
  const whereSql = where.join(' AND ')

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM parties p WHERE ${whereSql}`).get(...params) as { c: number }
  ).c
  const rows = db
    .prepare(`${SELECT_PARTY} WHERE ${whereSql} ORDER BY p.name COLLATE NOCASE ASC, p.id ASC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as PartyRow[]

  return { parties: rows.map(mapRow), total, page, pageSize }
}

function isMoney(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0
}

export function createParty(
  db: Database.Database,
  input: CreatePartyInput,
  userId?: number | null
): Result<Party> {
  const name = input.name.trim()
  if (!name) return err({ code: 'INVALID_NAME', message: 'Name is required' })

  const creditLimit = input.type === 'customer' ? (input.creditLimit ?? 0) : 0
  const opening = input.openingBalance ?? 0
  if (!isMoney(creditLimit) || !isMoney(opening)) {
    return err({ code: 'INVALID_AMOUNT', message: 'Amounts must be zero or more' })
  }

  const dup = db
    .prepare('SELECT 1 FROM parties WHERE type = ? AND LOWER(name) = LOWER(?) AND active = 1')
    .get(input.type, name)
  if (dup) return err({ code: 'PARTY_EXISTS', message: `An active ${input.type} named "${name}" already exists` })

  const now = nowLocal()
  return db.transaction((): Result<Party> => {
    const info = db
      .prepare(
        `INSERT INTO parties (type, name, phone, address, credit_limit, active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`
      )
      .run(input.type, name, input.phone?.trim() || null, input.address?.trim() || null, creditLimit, now)
    const id = Number(info.lastInsertRowid)

    if (opening > 0) {
      // Customer owes us -> debit. We owe supplier -> credit.
      const posted = postEntry(db, {
        partyId: id,
        type: 'opening',
        debit: input.type === 'customer' ? opening : 0,
        credit: input.type === 'supplier' ? opening : 0,
        refType: 'party',
        refId: id,
        note: 'Opening balance',
        userId,
        createdAt: now
      })
      if (!posted.ok) throw new Error(posted.error.message) // rolls the whole create back
    }

    logAudit(db, {
      userId,
      action: 'party_create',
      entity: 'party',
      entityId: id,
      details: { type: input.type, name, creditLimit, openingBalance: opening }
    })
    return ok(getPartyById(db, id) as Party)
  })()
}

export function updateParty(
  db: Database.Database,
  input: UpdatePartyInput,
  userId?: number | null
): Result<Party> {
  const existing = getPartyById(db, input.id)
  if (!existing) return err({ code: 'PARTY_NOT_FOUND', message: 'Customer or supplier not found' })

  const name = input.name.trim()
  if (!name) return err({ code: 'INVALID_NAME', message: 'Name is required' })
  const creditLimit = existing.type === 'customer' ? (input.creditLimit ?? existing.creditLimit) : 0
  if (!isMoney(creditLimit)) return err({ code: 'INVALID_AMOUNT', message: 'Credit limit must be zero or more' })

  const dup = db
    .prepare('SELECT 1 FROM parties WHERE type = ? AND LOWER(name) = LOWER(?) AND active = 1 AND id <> ?')
    .get(existing.type, name, existing.id)
  if (dup) return err({ code: 'PARTY_EXISTS', message: `An active ${existing.type} named "${name}" already exists` })

  return db.transaction((): Result<Party> => {
    db.prepare('UPDATE parties SET name = ?, phone = ?, address = ?, credit_limit = ? WHERE id = ?').run(
      name,
      input.phone?.trim() || null,
      input.address?.trim() || null,
      creditLimit,
      existing.id
    )
    logAudit(db, {
      userId,
      action: 'party_update',
      entity: 'party',
      entityId: existing.id,
      details: { before: { name: existing.name, creditLimit: existing.creditLimit }, after: { name, creditLimit } }
    })
    return ok(getPartyById(db, existing.id) as Party)
  })()
}

function setActive(db: Database.Database, id: number, active: 0 | 1, userId?: number | null): Result<void> {
  const existing = getPartyById(db, id)
  if (!existing) return err({ code: 'PARTY_NOT_FOUND', message: 'Customer or supplier not found' })
  if (active === 1 && existing.active === 0) {
    const dup = db
      .prepare('SELECT 1 FROM parties WHERE type = ? AND LOWER(name) = LOWER(?) AND active = 1 AND id <> ?')
      .get(existing.type, existing.name, id)
    if (dup) return err({ code: 'PARTY_EXISTS', message: `An active ${existing.type} with this name already exists` })
  }
  db.transaction(() => {
    db.prepare('UPDATE parties SET active = ? WHERE id = ?').run(active, id)
    logAudit(db, {
      userId,
      action: active ? 'party_reactivate' : 'party_deactivate',
      entity: 'party',
      entityId: id,
      details: { name: existing.name, balance: existing.balance }
    })
  })()
  return ok(undefined)
}

export const deactivateParty = (db: Database.Database, id: number, userId?: number | null): Result<void> =>
  setActive(db, id, 0, userId)
export const reactivateParty = (db: Database.Database, id: number, userId?: number | null): Result<void> =>
  setActive(db, id, 1, userId)
