import type Database from 'better-sqlite3'
import type { StockAllocator } from '../../modules/types'

/**
 * Default allocator (used when no module supplies one).
 * - Item without lots: one chunk with no lot.
 * - Item with lots: oldest lot first, only lots that still have stock. If the lots cannot cover
 *   the quantity, the chunks returned add up to less than asked and the sale service blocks it.
 * Expiry rules (FEFO, blocking expired lots) belong to the pharmacy module's allocator.
 */
export const defaultAllocator: StockAllocator = {
  allocate(db: Database.Database, itemId: number, qtyBase: number) {
    const item = db.prepare('SELECT track_lots FROM items WHERE id = ?').get(itemId) as
      | { track_lots: number }
      | undefined
    if (!item?.track_lots) return [{ lotId: null, qtyBase }]

    const lots = db
      .prepare(
        `SELECT l.id, COALESCE(SUM(m.qty), 0) AS stock
         FROM stock_lots l LEFT JOIN stock_movements m ON m.lot_id = l.id
         WHERE l.item_id = ?
         GROUP BY l.id HAVING stock > 0
         ORDER BY l.id`
      )
      .all(itemId) as Array<{ id: number; stock: number }>

    const out: Array<{ lotId: number | null; qtyBase: number }> = []
    let left = qtyBase
    for (const lot of lots) {
      if (left <= 0) break
      const take = Math.min(lot.stock, left)
      out.push({ lotId: lot.id, qtyBase: take })
      left -= take
    }
    return out
  }
}
