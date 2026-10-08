/**
 * Stock service. Stock = SUM(stock_movements.qty); `items.stock_cache` mirrors it.
 * This is the ONLY place that inserts into `stock_movements` for purchases/sales
 * (items/service.ts writes the one-off `opening` movement itself).
 *
 * None of these functions open a transaction: callers (purchases, sales) wrap them
 * in their own db.transaction() so movement + lot + cache + ledger are atomic.
 */
import type Database from 'better-sqlite3'
import { ok, err, type Result } from '@shared/result'
import { nowLocal } from '@shared/dates'

export type MovementType =
  | 'purchase'
  | 'sale'
  | 'sale_return'
  | 'purchase_return'
  | 'adjust'
  | 'opening'

export interface PostMovementInput {
  itemId: number
  lotId?: number | null
  qty: number // signed base units, non-zero
  type: MovementType
  refType?: string | null
  refId?: number | null
  userId?: number | null
  /** Let item/lot stock go below zero (e.g. selling before stock is entered). Default false. */
  allowNegative?: boolean
}

export function getItemStock(db: Database.Database, itemId: number): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(qty), 0) AS q FROM stock_movements WHERE item_id = ?')
    .get(itemId) as { q: number }
  return row.q
}

export function getLotStock(db: Database.Database, lotId: number): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(qty), 0) AS q FROM stock_movements WHERE lot_id = ?')
    .get(lotId) as { q: number }
  return row.q
}

/** Inserts one movement and keeps items.stock_cache in sync. */
export function postMovement(db: Database.Database, input: PostMovementInput): Result<number> {
  if (!Number.isSafeInteger(input.qty) || input.qty === 0) {
    return err({ code: 'INVALID_QTY', message: 'Quantity must be a non-zero whole number' })
  }
  if (!input.allowNegative && input.qty < 0) {
    const itemStock = getItemStock(db, input.itemId)
    if (itemStock + input.qty < 0) {
      return err({
        code: 'INSUFFICIENT_STOCK',
        message: `Not enough stock: have ${itemStock}, need ${-input.qty}`
      })
    }
    if (input.lotId != null) {
      const lotStock = getLotStock(db, input.lotId)
      if (lotStock + input.qty < 0) {
        return err({
          code: 'INSUFFICIENT_STOCK',
          message: `Not enough stock in this batch: have ${lotStock}, need ${-input.qty}`
        })
      }
    }
  }

  const info = db
    .prepare(
      `INSERT INTO stock_movements (item_id, lot_id, qty, type, ref_type, ref_id, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.itemId,
      input.lotId ?? null,
      input.qty,
      input.type,
      input.refType ?? null,
      input.refId ?? null,
      input.userId ?? null,
      nowLocal()
    )
  db.prepare('UPDATE items SET stock_cache = stock_cache + ? WHERE id = ?').run(input.qty, input.itemId)
  return ok(Number(info.lastInsertRowid))
}

/**
 * Returns the lot with this item + lot number, creating it if new.
 * The same lot number with a different expiry is rejected (it would be a different batch).
 */
export function findOrCreateLot(
  db: Database.Database,
  input: { itemId: number; lotNo: string; expiryDate: string | null; costPrice: number }
): Result<number> {
  const existing = db
    .prepare('SELECT id, expiry_date FROM stock_lots WHERE item_id = ? AND lot_no = ?')
    .get(input.itemId, input.lotNo) as { id: number; expiry_date: string | null } | undefined
  if (existing) {
    if ((existing.expiry_date ?? null) !== input.expiryDate) {
      return err({
        code: 'LOT_EXPIRY_MISMATCH',
        message: `Batch ${input.lotNo} already exists with expiry ${existing.expiry_date ?? 'none'}`
      })
    }
    return ok(existing.id)
  }
  const info = db
    .prepare(
      `INSERT INTO stock_lots (item_id, lot_no, expiry_date, cost_price, sale_price, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`
    )
    .run(input.itemId, input.lotNo, input.expiryDate, input.costPrice, nowLocal())
  return ok(Number(info.lastInsertRowid))
}
