/**
 * Want-book: medicines to order. Auto entries are added inside the sale transaction when an item's
 * stock falls to/below its reorder level (reorder level 0 = only when it hits zero). While an item
 * already has an open or ordered entry, no new auto entry is added. Entries are never deleted:
 * 'done' retires them. Supplier = the supplier of the item's latest purchase unless chosen.
 */
import type Database from 'better-sqlite3'
import { err, ok, type Result } from '@shared/result'
import { nowLocal } from '@shared/dates'
import type { WantBookAddInput, WantBookEntry, WantStatus } from '@shared/types'

const LAST_SUPPLIER = `(SELECT p.supplier_id FROM purchase_lines pl JOIN purchases p ON p.id = pl.purchase_id
                        WHERE pl.item_id = w.item_id ORDER BY pl.id DESC LIMIT 1)`

function hasActive(db: Database.Database, itemId: number): number | null {
  const r = db
    .prepare("SELECT id FROM pharmacy_want_book WHERE item_id = ? AND status IN ('open', 'ordered') LIMIT 1")
    .get(itemId) as { id: number } | undefined
  return r?.id ?? null
}

function lastSupplier(db: Database.Database, itemId: number): number | null {
  const r = db
    .prepare(
      `SELECT p.supplier_id FROM purchase_lines pl JOIN purchases p ON p.id = pl.purchase_id
       WHERE pl.item_id = ? ORDER BY pl.id DESC LIMIT 1`
    )
    .get(itemId) as { supplier_id: number } | undefined
  return r?.supplier_id ?? null
}

/** Runs inside completeSale's transaction (onSaleCompleted). Returns the item ids added. */
export function autoAddForSale(db: Database.Database, saleId: number): number[] {
  const low = db
    .prepare(
      `SELECT DISTINCT i.id, i.stock_cache, i.reorder_level
       FROM sale_lines sl JOIN items i ON i.id = sl.item_id
       WHERE sl.sale_id = ? AND i.track_stock = 1 AND i.active = 1 AND i.stock_cache <= i.reorder_level`
    )
    .all(saleId) as Array<{ id: number; stock_cache: number; reorder_level: number }>
  const added: number[] = []
  const now = nowLocal()
  for (const it of low) {
    if (hasActive(db, it.id) !== null) continue
    const qty = Math.max(it.reorder_level * 2 - it.stock_cache, 1) // refill to twice the reorder level
    db.prepare(
      `INSERT INTO pharmacy_want_book (item_id, supplier_id, qty, source, status, created_at, updated_at)
       VALUES (?, ?, ?, 'auto', 'open', ?, ?)`
    ).run(it.id, lastSupplier(db, it.id), qty, now, now)
    added.push(it.id)
  }
  return added
}

export function addManual(db: Database.Database, input: WantBookAddInput): Result<WantBookEntry> {
  if (!Number.isSafeInteger(input.qty) || input.qty < 1) {
    return err({ code: 'INVALID_QTY', message: 'Quantity must be a whole number, at least 1' })
  }
  const freeText = input.freeText?.trim() || null
  const itemId = input.itemId ?? null
  if (itemId === null && !freeText) return err({ code: 'ITEM_REQUIRED', message: 'Choose a medicine or type its name' })
  if (itemId !== null) {
    if (!db.prepare('SELECT 1 FROM items WHERE id = ?').get(itemId)) return err({ code: 'NOT_FOUND', message: 'Item not found' })
    const existing = hasActive(db, itemId)
    if (existing !== null) return ok(getEntry(db, existing)!) // already on the list: nothing to add
  }
  if (input.supplierId != null) {
    const s = db.prepare("SELECT type FROM parties WHERE id = ?").get(input.supplierId) as { type: string } | undefined
    if (!s || s.type !== 'supplier') return err({ code: 'WRONG_PARTY_TYPE', message: 'Choose a supplier' })
  }
  const now = nowLocal()
  const info = db
    .prepare(
      `INSERT INTO pharmacy_want_book (item_id, free_text, supplier_id, qty, source, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'manual', 'open', ?, ?)`
    )
    .run(itemId, itemId === null ? freeText : null, input.supplierId ?? (itemId ? lastSupplier(db, itemId) : null), input.qty, now, now)
  return ok(getEntry(db, Number(info.lastInsertRowid))!)
}

export function setStatus(db: Database.Database, id: number, status: WantStatus): Result<WantBookEntry> {
  const r = db
    .prepare('UPDATE pharmacy_want_book SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, nowLocal(), id)
  if (r.changes === 0) return err({ code: 'NOT_FOUND', message: 'Want-book entry not found' })
  return ok(getEntry(db, id)!)
}

const SELECT = `SELECT w.id, w.item_id, COALESCE(i.name, w.free_text) AS name, w.qty, w.source, w.status, w.created_at,
                       COALESCE(w.supplier_id, ${LAST_SUPPLIER}) AS supplier_id, s.name AS supplier_name
                FROM pharmacy_want_book w LEFT JOIN items i ON i.id = w.item_id
                LEFT JOIN parties s ON s.id = COALESCE(w.supplier_id, ${LAST_SUPPLIER})`

interface Row {
  id: number
  item_id: number | null
  name: string
  qty: number
  source: 'auto' | 'manual'
  status: WantStatus
  created_at: string
  supplier_id: number | null
  supplier_name: string | null
}

function map(r: Row): WantBookEntry {
  return {
    id: r.id, itemId: r.item_id, itemName: r.name, qty: r.qty, supplierId: r.supplier_id,
    supplierName: r.supplier_name, source: r.source, status: r.status, createdAt: r.created_at
  }
}

function getEntry(db: Database.Database, id: number): WantBookEntry | null {
  const r = db.prepare(`${SELECT} WHERE w.id = ?`).get(id) as Row | undefined
  return r ? map(r) : null
}

/** status 'active' = open + ordered (what the shop still has to deal with). Grouping is done by the caller/screen. */
export function listWantBook(db: Database.Database, status: WantStatus | 'active' = 'active'): WantBookEntry[] {
  const where = status === 'active' ? "w.status IN ('open', 'ordered')" : 'w.status = ?'
  const rows = db
    .prepare(`${SELECT} WHERE ${where} ORDER BY (supplier_name IS NULL), supplier_name, name, w.id`)
    .all(...(status === 'active' ? [] : [status])) as Row[]
  return rows.map(map)
}

export function countOpen(db: Database.Database): number {
  return (db.prepare("SELECT COUNT(*) AS c FROM pharmacy_want_book WHERE status = 'open'").get() as { c: number }).c
}
