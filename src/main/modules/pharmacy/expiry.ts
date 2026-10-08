import type Database from 'better-sqlite3'
import { addDaysLocal, todayLocal } from '@shared/dates'
import type { ExpiryFilter, ExpiryRow, ExpirySummary } from '@shared/types'

interface Row {
  lot_id: number
  item_id: number
  item_name: string
  unit: string
  lot_no: string
  expiry_date: string
  qty: number
  supplier_id: number | null
  supplier_name: string | null
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / 86_400_000)
}

/**
 * Batches that still have stock and expire inside the range, soonest first.
 * 'expired' = expiry before today; 30/60/90 = expiring today .. today + N days.
 * Supplier = the supplier of the purchase that created the batch.
 */
export function listExpiry(db: Database.Database, filter: ExpiryFilter, today = todayLocal()): ExpiryRow[] {
  const expired = filter.range === 'expired'
  const lo = expired ? '0000-01-01' : today
  const hi = expired ? addDaysLocal(today, -1) : addDaysLocal(today, Number(filter.range))
  const supplierId = filter.supplierId ?? null
  const rows = db
    .prepare(
      `SELECT x.*, s.name AS supplier_name FROM (
         SELECT l.id AS lot_id, l.item_id, i.name AS item_name, i.base_unit AS unit, l.lot_no, l.expiry_date,
                (SELECT COALESCE(SUM(m.qty), 0) FROM stock_movements m WHERE m.lot_id = l.id) AS qty,
                (SELECT p.supplier_id FROM purchase_lines pl JOIN purchases p ON p.id = pl.purchase_id
                  WHERE pl.lot_id = l.id ORDER BY pl.id LIMIT 1) AS supplier_id
         FROM stock_lots l JOIN items i ON i.id = l.item_id
         WHERE l.expiry_date IS NOT NULL AND l.expiry_date >= ? AND l.expiry_date <= ?
       ) x LEFT JOIN parties s ON s.id = x.supplier_id
       WHERE x.qty > 0 AND (? IS NULL OR x.supplier_id = ?)
       ORDER BY x.expiry_date, x.item_name, x.lot_id`
    )
    .all(lo, hi, supplierId, supplierId) as Row[]
  return rows.map((r) => ({
    lotId: r.lot_id,
    itemId: r.item_id,
    itemName: r.item_name,
    unit: r.unit,
    lotNo: r.lot_no,
    expiryDate: r.expiry_date,
    daysLeft: daysBetween(today, r.expiry_date),
    qtyBase: r.qty,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name
  }))
}

export function expirySummary(db: Database.Database, today = todayLocal()): ExpirySummary {
  const count = (range: ExpiryFilter['range']): number => listExpiry(db, { range }, today).length
  return { expired: count('expired'), within30: count(30), within60: count(60), within90: count(90) }
}
