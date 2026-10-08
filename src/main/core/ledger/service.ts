/**
 * Party ledger (khata). This file is the ONLY place that inserts into `party_ledger`.
 *
 * SIGN CONVENTION (same for customers and suppliers, all amounts in paisa):
 *   balance = SUM(debit) - SUM(credit)
 *   balance > 0  -> the party owes the shop   (customer credit sales, receivable)
 *   balance < 0  -> the shop owes the party   (supplier purchases on credit, payable;
 *                   or a customer's advance)
 *
 * Direction per entry type:
 *   sale         customer  DEBIT    (customer owes more)
 *   payment_in   customer  CREDIT   (customer paid us)
 *   purchase     supplier  CREDIT   (we owe more)
 *   payment_out  supplier  DEBIT    (we paid them)
 *   opening/return/adjust  either side
 *   Customer opening balance = DEBIT; supplier opening balance = CREDIT.
 *
 * Other milestones (sales, purchases) call `postEntry` inside their OWN transaction.
 * `postEntry` never opens a transaction and does not log audit; it is a single INSERT
 * so it is atomic with whatever transaction the caller already has.
 * Functions here that need several writes use db.transaction(), which becomes a
 * savepoint when nested inside a caller's transaction.
 */
import type Database from 'better-sqlite3'
import { ok, err, type Result } from '@shared/result'
import { nowLocal } from '@shared/dates'
import type {
  LedgerEntry,
  LedgerEntryType,
  PartyType,
  RecordPaymentInput,
  Statement,
  StatementInput
} from '@shared/types'
import { logAudit } from '../audit/service'

export interface PostEntryInput {
  partyId: number
  type: LedgerEntryType
  debit?: number
  credit?: number
  refType?: string | null
  refId?: number | null
  note?: string | null
  userId?: number | null
  /** 'YYYY-MM-DD HH:mm:ss'. Defaults to now; mainly for tests and imports. */
  createdAt?: string
}

interface LedgerRow {
  id: number
  party_id: number
  type: LedgerEntryType
  ref_type: string | null
  ref_id: number | null
  debit: number
  credit: number
  note: string | null
  user_id: number | null
  created_at: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

// Entry types that are only valid on one side and for one kind of party.
const RULES: Partial<Record<LedgerEntryType, { side: 'debit' | 'credit'; party: PartyType }>> = {
  sale: { side: 'debit', party: 'customer' },
  payment_in: { side: 'credit', party: 'customer' },
  purchase: { side: 'credit', party: 'supplier' },
  payment_out: { side: 'debit', party: 'supplier' }
}

function mapRow(row: LedgerRow, balance: number): LedgerEntry {
  return {
    id: row.id,
    partyId: row.party_id,
    type: row.type,
    refType: row.ref_type,
    refId: row.ref_id,
    debit: row.debit,
    credit: row.credit,
    note: row.note,
    userId: row.user_id,
    createdAt: row.created_at,
    balance
  }
}

export function postEntry(db: Database.Database, input: PostEntryInput): Result<LedgerEntry> {
  const debit = input.debit ?? 0
  const credit = input.credit ?? 0
  if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit < 0 || credit < 0) {
    return err({ code: 'INVALID_AMOUNT', message: 'Amount must be a whole number of paisa, not negative' })
  }
  if ((debit > 0) === (credit > 0)) {
    return err({ code: 'INVALID_AMOUNT', message: 'Enter an amount on exactly one side (debit or credit)' })
  }
  if (input.createdAt !== undefined && !DATETIME_RE.test(input.createdAt)) {
    return err({ code: 'INVALID_DATE', message: 'Date must look like YYYY-MM-DD HH:mm:ss' })
  }

  const party = db.prepare('SELECT type, active FROM parties WHERE id = ?').get(input.partyId) as
    | { type: PartyType; active: number }
    | undefined
  if (!party) {
    return err({ code: 'PARTY_NOT_FOUND', message: 'Customer or supplier not found' })
  }

  const rule = RULES[input.type]
  if (rule) {
    if (party.type !== rule.party) {
      return err({ code: 'WRONG_PARTY_TYPE', message: `A ${input.type} entry needs a ${rule.party}` })
    }
    if ((rule.side === 'debit' ? debit : credit) === 0) {
      return err({ code: 'WRONG_SIDE', message: `A ${input.type} entry must be a ${rule.side}` })
    }
  }
  if (!party.active && (input.type === 'sale' || input.type === 'purchase')) {
    return err({ code: 'PARTY_INACTIVE', message: 'This account is deactivated. Reactivate it first.' })
  }

  const createdAt = input.createdAt ?? nowLocal()
  const info = db
    .prepare(
      `INSERT INTO party_ledger (party_id, type, ref_type, ref_id, debit, credit, note, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.partyId,
      input.type,
      input.refType ?? null,
      input.refId ?? null,
      debit,
      credit,
      input.note?.trim() || null,
      input.userId ?? null,
      createdAt
    )

  const row = db.prepare('SELECT * FROM party_ledger WHERE id = ?').get(info.lastInsertRowid) as LedgerRow
  return ok(mapRow(row, getBalance(db, input.partyId)))
}

/** Current balance in paisa. Positive = party owes the shop. */
export function getBalance(db: Database.Database, partyId: number): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(debit) - SUM(credit), 0) AS balance FROM party_ledger WHERE party_id = ?')
    .get(partyId) as { balance: number }
  return row.balance
}

export function getStatement(db: Database.Database, input: StatementInput): Result<Statement> {
  const { from, to } = input
  if ((from !== undefined && !DATE_RE.test(from)) || (to !== undefined && !DATE_RE.test(to))) {
    return err({ code: 'INVALID_DATE', message: 'Dates must look like YYYY-MM-DD' })
  }
  if (from && to && from > to) {
    return err({ code: 'INVALID_RANGE', message: 'The start date must be before the end date' })
  }
  if (!db.prepare('SELECT 1 FROM parties WHERE id = ?').get(input.partyId)) {
    return err({ code: 'PARTY_NOT_FOUND', message: 'Customer or supplier not found' })
  }

  const fromTs = from ? `${from} 00:00:00` : null
  const toTs = to ? `${to} 23:59:59` : null

  // Balance carried in from before the start date.
  const openingBalance = fromTs
    ? (
        db
          .prepare(
            `SELECT COALESCE(SUM(debit) - SUM(credit), 0) AS b FROM party_ledger
             WHERE party_id = ? AND created_at < ?`
          )
          .get(input.partyId, fromTs) as { b: number }
      ).b
    : 0

  const rows = db
    .prepare(
      `SELECT * FROM party_ledger
       WHERE party_id = ? AND (? IS NULL OR created_at >= ?) AND (? IS NULL OR created_at <= ?)
       ORDER BY created_at ASC, id ASC`
    )
    .all(input.partyId, fromTs, fromTs, toTs, toTs) as LedgerRow[]

  let running = openingBalance
  let totalDebit = 0
  let totalCredit = 0
  const entries = rows.map((row) => {
    running += row.debit - row.credit
    totalDebit += row.debit
    totalCredit += row.credit
    return mapRow(row, running)
  })

  return ok({
    partyId: input.partyId,
    from: from ?? null,
    to: to ?? null,
    openingBalance,
    entries,
    totalDebit,
    totalCredit,
    closingBalance: running
  })
}

/**
 * Customer pays the shop (payment_in, credit) or shop pays a supplier (payment_out, debit).
 * Paying more than is owed is allowed; the balance just goes to the other side (advance).
 */
export function recordPayment(
  db: Database.Database,
  input: RecordPaymentInput,
  userId?: number | null
): Result<LedgerEntry> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    return err({ code: 'INVALID_AMOUNT', message: 'Payment amount must be more than zero' })
  }
  const party = db.prepare('SELECT id, type FROM parties WHERE id = ?').get(input.partyId) as
    | { id: number; type: PartyType }
    | undefined
  if (!party) return err({ code: 'PARTY_NOT_FOUND', message: 'Customer or supplier not found' })
  const isCustomer = party.type === 'customer'

  return db.transaction((): Result<LedgerEntry> => {
    const res = postEntry(db, {
      partyId: party.id,
      type: isCustomer ? 'payment_in' : 'payment_out',
      credit: isCustomer ? input.amount : 0,
      debit: isCustomer ? 0 : input.amount,
      refType: 'payment',
      note: input.note,
      userId
    })
    if (!res.ok) return res
    logAudit(db, {
      userId,
      action: isCustomer ? 'payment_in' : 'payment_out',
      entity: 'party',
      entityId: party.id,
      details: { amount: input.amount, ledgerId: res.data.id, balanceAfter: res.data.balance }
    })
    return res
  })()
}
