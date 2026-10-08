import type Database from 'better-sqlite3'
import { ok, type Result } from '@shared/result'
import { nowLocal } from '@shared/dates'
import type { ZReport } from '@shared/types'
import { computeShiftCash, getShift, listEntries } from './service'

/** Day-end (Z) report for one shift. Works on an open shift too (an X report: not final). */
export function getZReport(db: Database.Database, shiftId: number): Result<ZReport> {
  const shift = getShift(db, shiftId)
  if (!shift) return { ok: false, error: { code: 'SHIFT_NOT_FOUND', message: 'Shift not found' } }
  const sales = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(subtotal), 0) AS subtotal, COALESCE(SUM(discount), 0) AS discount,
              COALESCE(SUM(total), 0) AS total, COALESCE(SUM(paid_cash), 0) AS cash, COALESCE(SUM(paid_credit), 0) AS credit
       FROM sales WHERE shift_id = ? AND status = 'completed'`
    )
    .get(shiftId) as { count: number; subtotal: number; discount: number; total: number; cash: number; credit: number }
  const returns = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total, COALESCE(SUM(refund_cash), 0) AS cash,
              COALESCE(SUM(refund_credit), 0) AS credit FROM sale_returns WHERE shift_id = ?`
    )
    .get(shiftId) as { count: number; total: number; cash: number; credit: number }
  const voids = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM sales
       WHERE void_shift_id = ? AND status = 'void'`
    )
    .get(shiftId) as { count: number; total: number }
  return ok({
    shift,
    cash: computeShiftCash(db, shiftId),
    sales: { count: sales.count, subtotal: sales.subtotal, discount: sales.discount, total: sales.total },
    byPayment: { cash: sales.cash, credit: sales.credit },
    returns,
    voids,
    entries: listEntries(db, shiftId),
    generatedAt: nowLocal()
  })
}
