/**
 * Cash shifts (single till). One shift open at a time (also enforced by a unique index).
 *
 * Expected cash = opening + cash sales - cash refunds + cash in - cash out - expenses
 *                 - cash paid to suppliers + cash received from customers (khata payments).
 * - cash sales    = SUM(sales.paid_cash) of the shift. paid_cash is the cash that STAYED in the
 *                   drawer (total - credit); change handed back is never stored, so it is not counted.
 * - cash refunds  = sale_returns.refund_cash tagged with the shift + paid_cash of sales voided
 *                   while this shift was open (sales.void_shift_id). A sale sold and voided in the
 *                   same shift therefore nets to zero.
 * - supplier paid = purchases.paid + standalone supplier payments tagged with the shift.
 * Anything done while NO shift is open is simply not tracked (shift_id stays NULL).
 */
import type Database from 'better-sqlite3'
import { ok, type Result } from '@shared/result'
import { nowLocal } from '@shared/dates'
import type {
  CashEntry, CashEntryInput, CashEntryType, CloseShiftInput, OpenShiftInput, Shift, ShiftCash, ShiftDetail
} from '@shared/types'
import { abort, runAtomic } from '../../db/tx'
import { logAudit } from '../audit/service'

const MAX_MONEY = Number.MAX_SAFE_INTEGER

interface ShiftRow {
  id: number
  user_id: number
  user_name: string
  opened_at: string
  opening_cash: number
  closed_at: string | null
  expected_cash: number | null
  counted_cash: number | null
  note: string | null
}

const SHIFT_SQL = `SELECT s.id, s.user_id, u.name AS user_name, s.opened_at, s.opening_cash, s.closed_at,
  s.expected_cash, s.counted_cash, s.note FROM cash_shifts s JOIN users u ON u.id = s.user_id`

function mapShift(r: ShiftRow): Shift {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    openedAt: r.opened_at,
    openingCash: r.opening_cash,
    closedAt: r.closed_at,
    expectedCash: r.expected_cash,
    countedCash: r.counted_cash,
    difference: r.counted_cash != null && r.expected_cash != null ? r.counted_cash - r.expected_cash : null,
    note: r.note
  }
}

export function getShift(db: Database.Database, id: number): Shift | null {
  const r = db.prepare(`${SHIFT_SQL} WHERE s.id = ?`).get(id) as ShiftRow | undefined
  return r ? mapShift(r) : null
}

export function getOpenShift(db: Database.Database): Shift | null {
  const r = db.prepare(`${SHIFT_SQL} WHERE s.closed_at IS NULL`).get() as ShiftRow | undefined
  return r ? mapShift(r) : null
}

/** Cheap lookup used inside other services' transactions. */
export function getOpenShiftId(db: Database.Database): number | null {
  const r = db.prepare('SELECT id FROM cash_shifts WHERE closed_at IS NULL').get() as { id: number } | undefined
  return r?.id ?? null
}

export function listShifts(db: Database.Database, limit = 30): Shift[] {
  const rows = db
    .prepare(`${SHIFT_SQL} ORDER BY s.id DESC LIMIT ?`)
    .all(Math.min(Math.max(limit, 1), 200)) as ShiftRow[]
  return rows.map(mapShift)
}

function sum(db: Database.Database, sql: string, shiftId: number): number {
  return (db.prepare(sql).get(shiftId) as { v: number }).v
}

export function computeShiftCash(db: Database.Database, shiftId: number): ShiftCash {
  const shift = db.prepare('SELECT opening_cash FROM cash_shifts WHERE id = ?').get(shiftId) as
    | { opening_cash: number }
    | undefined
  if (!shift) abort('SHIFT_NOT_FOUND', 'Shift not found')
  const entry = (type: CashEntryType): number =>
    sum(db, `SELECT COALESCE(SUM(amount), 0) AS v FROM cash_entries WHERE shift_id = ? AND type = '${type}'`, shiftId)

  const cashSales = sum(
    db, `SELECT COALESCE(SUM(paid_cash), 0) AS v FROM sales WHERE shift_id = ? AND status IN ('completed','void')`, shiftId
  )
  const cashRefunds =
    sum(db, 'SELECT COALESCE(SUM(refund_cash), 0) AS v FROM sale_returns WHERE shift_id = ?', shiftId) +
    sum(db, `SELECT COALESCE(SUM(paid_cash), 0) AS v FROM sales WHERE void_shift_id = ? AND status = 'void'`, shiftId)
  const supplierPaid =
    sum(db, 'SELECT COALESCE(SUM(paid), 0) AS v FROM purchases WHERE shift_id = ?', shiftId) +
    sum(db, `SELECT COALESCE(SUM(debit), 0) AS v FROM party_ledger WHERE shift_id = ? AND type = 'payment_out'`, shiftId)
  const customerPaid = sum(
    db, `SELECT COALESCE(SUM(credit), 0) AS v FROM party_ledger WHERE shift_id = ? AND type = 'payment_in'`, shiftId
  )
  const cashIn = entry('in')
  const cashOut = entry('out')
  const expenses = entry('expense')
  const openingCash = shift.opening_cash
  return {
    openingCash, cashSales, cashRefunds, cashIn, cashOut, expenses, supplierPaid, customerPaid,
    expectedCash: openingCash + cashSales - cashRefunds + cashIn - cashOut - expenses - supplierPaid + customerPaid
  }
}

export function listEntries(db: Database.Database, shiftId: number): CashEntry[] {
  const rows = db
    .prepare(
      `SELECT e.id, e.shift_id, e.type, e.amount, e.note, e.user_id, u.name AS user_name, e.created_at
       FROM cash_entries e JOIN users u ON u.id = e.user_id WHERE e.shift_id = ? ORDER BY e.id`
    )
    .all(shiftId) as Array<{
    id: number; shift_id: number; type: CashEntryType; amount: number; note: string | null
    user_id: number; user_name: string; created_at: string
  }>
  return rows.map((r) => ({
    id: r.id, shiftId: r.shift_id, type: r.type, amount: r.amount, note: r.note,
    userId: r.user_id, userName: r.user_name, createdAt: r.created_at
  }))
}

export function getShiftDetail(db: Database.Database, shiftId: number): Result<ShiftDetail> {
  const shift = getShift(db, shiftId)
  if (!shift) return { ok: false, error: { code: 'SHIFT_NOT_FOUND', message: 'Shift not found' } }
  return ok({ shift, cash: computeShiftCash(db, shiftId), entries: listEntries(db, shiftId) })
}

function checkMoney(v: number, what: string, allowZero: boolean): void {
  if (!Number.isSafeInteger(v) || v < 0 || v > MAX_MONEY || (!allowZero && v === 0)) {
    abort('INVALID_AMOUNT', `${what} must be a whole number of paisa${allowZero ? '' : ' above zero'}`)
  }
}

export function openShift(db: Database.Database, input: OpenShiftInput, userId: number): Result<Shift> {
  const run = db.transaction((): number => {
    checkMoney(input.openingCash, 'Opening cash', true)
    if (getOpenShiftId(db) != null) abort('SHIFT_ALREADY_OPEN', 'A shift is already open. Close it before opening another.')
    const info = db
      .prepare('INSERT INTO cash_shifts (user_id, opened_at, opening_cash) VALUES (?, ?, ?)')
      .run(userId, nowLocal(), input.openingCash)
    const id = Number(info.lastInsertRowid)
    logAudit(db, { userId, action: 'shift_opened', entity: 'cash_shifts', entityId: id, details: { openingCash: input.openingCash } })
    return id
  })
  const res = runAtomic(() => run())
  return res.ok ? ok(getShift(db, res.data)!) : res
}

function openShiftOrAbort(db: Database.Database, shiftId: number): void {
  const s = db.prepare('SELECT closed_at FROM cash_shifts WHERE id = ?').get(shiftId) as
    | { closed_at: string | null }
    | undefined
  if (!s) abort('SHIFT_NOT_FOUND', 'Shift not found')
  if (s.closed_at) abort('SHIFT_CLOSED', 'This shift is closed. Open a new shift first.')
}

export function addCashEntry(db: Database.Database, input: CashEntryInput, userId: number): Result<CashEntry> {
  const run = db.transaction((): number => {
    openShiftOrAbort(db, input.shiftId)
    checkMoney(input.amount, 'Amount', false)
    const note = input.note?.trim() || null
    if (input.type !== 'in' && !note) abort('NOTE_REQUIRED', 'Write a short note (what was the money for?)')
    const info = db
      .prepare('INSERT INTO cash_entries (shift_id, type, amount, note, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(input.shiftId, input.type, input.amount, note, userId, nowLocal())
    const id = Number(info.lastInsertRowid)
    logAudit(db, {
      userId, action: `cash_${input.type}`, entity: 'cash_entries', entityId: id,
      details: { shiftId: input.shiftId, amount: input.amount, note }
    })
    return id
  })
  const res = runAtomic(() => run())
  if (!res.ok) return res
  return ok(listEntries(db, input.shiftId).find((e) => e.id === res.data)!)
}

export function closeShift(db: Database.Database, input: CloseShiftInput, userId: number): Result<ShiftDetail> {
  const run = db.transaction((): void => {
    openShiftOrAbort(db, input.shiftId)
    checkMoney(input.countedCash, 'Counted cash', true)
    const cash = computeShiftCash(db, input.shiftId)
    db.prepare(
      'UPDATE cash_shifts SET closed_at = ?, expected_cash = ?, counted_cash = ?, note = ? WHERE id = ?'
    ).run(nowLocal(), cash.expectedCash, input.countedCash, input.note?.trim() || null, input.shiftId)
    logAudit(db, {
      userId, action: 'shift_closed', entity: 'cash_shifts', entityId: input.shiftId,
      details: { expected: cash.expectedCash, counted: input.countedCash, difference: input.countedCash - cash.expectedCash }
    })
  })
  const res = runAtomic(() => run())
  return res.ok ? getShiftDetail(db, input.shiftId) : res
}
