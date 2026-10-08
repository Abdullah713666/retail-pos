import type Database from 'better-sqlite3'
import { ok, err, type Result } from '@shared/result'
import { nowLocal } from '@shared/dates'
import type {
  Item,
  ItemUnit,
  CreateItemInput,
  UpdateItemInput,
  ItemFilter,
  ItemListResult,
  BarcodeLookupResult
} from '@shared/types'
import { logAudit } from '../audit/service'
import { checkBarcodes } from './barcodes'

export { listCategories, createCategory } from './categories'
export { getAllExistingBarcodes, previewCsv, importCsv } from './import'

interface ItemRow {
  id: number
  name: string
  search_text: string
  barcode: string | null
  category_id: number | null
  category_name: string | null
  base_unit: string
  sale_price: number
  cost_price: number
  reorder_level: number
  track_stock: number
  track_lots: number
  stock_cache: number
  active: number
  created_at: string
  updated_at: string
}

function mapItemRow(row: ItemRow, units: ItemUnit[]): Item {
  return {
    id: row.id,
    name: row.name,
    searchText: row.search_text,
    barcode: row.barcode,
    categoryId: row.category_id,
    categoryName: row.category_name,
    baseUnit: row.base_unit,
    salePrice: row.sale_price,
    costPrice: row.cost_price,
    reorderLevel: row.reorder_level,
    trackStock: row.track_stock,
    trackLots: row.track_lots,
    stockCache: row.stock_cache,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    units
  }
}

function escapeLike(word: string): string {
  return word.replace(/[\\%_]/g, (c) => `\\${c}`)
}

function getItemUnits(db: Database.Database, itemId: number): ItemUnit[] {
  return db
    .prepare(
      'SELECT id, item_id as itemId, name, factor, barcode, sale_price as salePrice FROM item_units WHERE item_id = ? ORDER BY factor ASC'
    )
    .all(itemId) as ItemUnit[]
}

export function getItemById(db: Database.Database, id: number): Item | null {
  const row = db
    .prepare(`
      SELECT i.*, c.name as category_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.id = ?
    `)
    .get(id) as ItemRow | undefined

  if (!row) return null
  return mapItemRow(row, getItemUnits(db, id))
}

export function createItem(
  db: Database.Database,
  input: CreateItemInput,
  userId?: number | null
): Result<Item> {
  const name = input.name.trim()
  if (!name) {
    return err({ code: 'INVALID_NAME', message: 'Item name is required' })
  }

  const baseUnit = input.baseUnit.trim() || 'pc'
  const barcode = input.barcode?.trim() || null
  const { salePrice, costPrice } = input

  if (salePrice < 0 || costPrice < 0) {
    return err({ code: 'INVALID_PRICE', message: 'Price cannot be negative' })
  }

  const units = input.units || []
  const barcodeCheck = checkBarcodes(db, barcode, units)
  if (!barcodeCheck.ok) return barcodeCheck

  const searchText = `${name} ${input.aliases || ''}`.toLowerCase().replace(/\s+/g, ' ').trim()
  const now = nowLocal()
  const openingQty = input.openingStock && input.openingStock.qty > 0 ? input.openingStock.qty : 0
  if (input.trackLots && openingQty > 0) {
    return err({
      code: 'LOT_REQUIRED',
      message: 'Add stock for batch items through Purchase'
    })
  }

  const runTx = db.transaction((): Item => {
    const info = db
      .prepare(`
        INSERT INTO items (
          name, search_text, barcode, category_id, base_unit,
          sale_price, cost_price, reorder_level, track_stock, track_lots,
          stock_cache, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `)
      .run(
        name,
        searchText,
        barcode,
        input.categoryId ?? null,
        baseUnit,
        salePrice,
        costPrice,
        input.reorderLevel ?? 0,
        input.trackStock === false ? 0 : 1,
        input.trackLots ? 1 : 0,
        openingQty,
        now,
        now
      )

    const itemId = Number(info.lastInsertRowid)

    if (units.length > 0) {
      const unitStmt = db.prepare(`
        INSERT INTO item_units (item_id, name, factor, barcode, sale_price)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const u of units) {
        unitStmt.run(itemId, u.name.trim(), u.factor, u.barcode?.trim() || null, u.salePrice ?? null)
      }
    }

    if (openingQty > 0) {
      db.prepare(`
        INSERT INTO stock_movements (item_id, lot_id, qty, type, ref_type, ref_id, user_id, created_at)
        VALUES (?, NULL, ?, 'opening', 'opening', ?, ?, ?)
      `).run(itemId, openingQty, itemId, userId ?? null, now)
    }

    logAudit(db, {
      userId,
      action: 'item_created',
      entity: 'items',
      entityId: itemId,
      details: { name, barcode, openingQty }
    })

    return getItemById(db, itemId)!
  })

  return ok(runTx())
}

export function updateItem(
  db: Database.Database,
  input: UpdateItemInput,
  userId?: number | null
): Result<Item> {
  const current = getItemById(db, input.id)
  if (!current) return err({ code: 'NOT_FOUND', message: 'Item not found' })

  const name = input.name.trim()
  if (!name) return err({ code: 'INVALID_NAME', message: 'Item name is required' })

  const barcode = input.barcode?.trim() || null
  const units = input.units || []
  const barcodeCheck = checkBarcodes(db, barcode, units, input.id)
  if (!barcodeCheck.ok) return barcodeCheck

  const searchText = `${name} ${input.aliases || ''}`.toLowerCase().replace(/\s+/g, ' ').trim()
  const now = nowLocal()

  const runTx = db.transaction((): Item => {
    db.prepare(`
      UPDATE items SET
        name = ?, search_text = ?, barcode = ?, category_id = ?, base_unit = ?,
        sale_price = ?, cost_price = ?, reorder_level = ?, track_stock = ?,
        track_lots = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name,
      searchText,
      barcode,
      input.categoryId ?? null,
      input.baseUnit.trim() || 'pc',
      input.salePrice,
      input.costPrice,
      input.reorderLevel ?? 0,
      input.trackStock === false ? 0 : 1,
      input.trackLots ? 1 : 0,
      now,
      input.id
    )

    db.prepare('DELETE FROM item_units WHERE item_id = ?').run(input.id)

    if (units.length > 0) {
      const unitStmt = db.prepare(`
        INSERT INTO item_units (item_id, name, factor, barcode, sale_price)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const u of units) {
        unitStmt.run(input.id, u.name.trim(), u.factor, u.barcode?.trim() || null, u.salePrice ?? null)
      }
    }

    logAudit(db, {
      userId,
      action: 'item_updated',
      entity: 'items',
      entityId: input.id,
      details: { name, barcode }
    })

    return getItemById(db, input.id)!
  })

  return ok(runTx())
}

export function deactivateItem(
  db: Database.Database,
  id: number,
  userId?: number | null
): Result<void> {
  const current = getItemById(db, id)
  if (!current) return err({ code: 'NOT_FOUND', message: 'Item not found' })

  db.prepare('UPDATE items SET active = 0, updated_at = ? WHERE id = ?').run(nowLocal(), id)
  logAudit(db, { userId, action: 'item_deactivated', entity: 'items', entityId: id })
  return ok(undefined)
}

export function reactivateItem(
  db: Database.Database,
  id: number,
  userId?: number | null
): Result<void> {
  const current = getItemById(db, id)
  if (!current) return err({ code: 'NOT_FOUND', message: 'Item not found' })

  db.prepare('UPDATE items SET active = 1, updated_at = ? WHERE id = ?').run(nowLocal(), id)
  logAudit(db, { userId, action: 'item_reactivated', entity: 'items', entityId: id })
  return ok(undefined)
}

export function lookupBarcode(
  db: Database.Database,
  barcode: string
): BarcodeLookupResult | null {
  const trimmed = barcode.trim()
  if (!trimmed) return null

  const itemRow = db
    .prepare('SELECT id FROM items WHERE barcode = ? AND active = 1')
    .get(trimmed) as { id: number } | undefined
  if (itemRow) {
    const item = getItemById(db, itemRow.id)
    if (item) return { item, unit: null }
  }

  const unitRow = db
    .prepare('SELECT id, item_id as itemId FROM item_units WHERE barcode = ?')
    .get(trimmed) as { id: number; itemId: number } | undefined
  if (unitRow) {
    const item = getItemById(db, unitRow.itemId)
    if (item && item.active === 1) {
      const unit = item.units.find((u) => u.id === unitRow.id) || null
      return { item, unit }
    }
  }

  return null
}

export function searchItems(
  db: Database.Database,
  query: string,
  limit = 50
): Item[] {
  const trimmed = query.trim()
  if (!trimmed) {
    const rows = db
      .prepare(`
        SELECT i.*, c.name as category_name
        FROM items i
        LEFT JOIN categories c ON i.category_id = c.id
        WHERE i.active = 1
        ORDER BY i.name COLLATE NOCASE ASC
        LIMIT ?
      `)
      .all(limit) as ItemRow[]
    return rows.map((r) => mapItemRow(r, getItemUnits(db, r.id)))
  }

  const exact = lookupBarcode(db, trimmed)
  const exactItem = exact?.item

  const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean)
  const conditions = words
    .map(() => "(i.search_text LIKE ? ESCAPE '\\' OR i.barcode LIKE ? ESCAPE '\\')")
    .join(' AND ')
  const params: Array<string | number> = []
  for (const w of words) {
    const like = `%${escapeLike(w)}%`
    params.push(like, like)
  }

  params.push(limit)
  const rows = db
    .prepare(`
      SELECT i.*, c.name as category_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.active = 1 AND (${conditions})
      ORDER BY i.name COLLATE NOCASE ASC
      LIMIT ?
    `)
    .all(...params) as ItemRow[]

  const results = rows.map((r) => mapItemRow(r, getItemUnits(db, r.id)))
  if (exactItem && !results.some((it) => it.id === exactItem.id)) {
    results.unshift(exactItem)
  }

  return results
}

export function listItems(db: Database.Database, filter: ItemFilter): ItemListResult {
  const conditions: string[] = []
  const params: Array<string | number> = []

  if (filter.activeOnly !== false) {
    conditions.push('i.active = 1')
  }

  if (filter.categoryId) {
    conditions.push('i.category_id = ?')
    params.push(filter.categoryId)
  }

  if (filter.query && filter.query.trim()) {
    const words = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    for (const w of words) {
      conditions.push("(i.search_text LIKE ? ESCAPE '\\' OR i.barcode LIKE ? ESCAPE '\\')")
      const like = `%${escapeLike(w)}%`
      params.push(like, like)
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const countRow = db
    .prepare(`SELECT count(*) as total FROM items i ${whereClause}`)
    .get(...params) as { total: number }

  const page = Math.max(filter.page || 1, 1)
  const pageSize = Math.max(filter.pageSize || 25, 1)
  const offset = (page - 1) * pageSize

  const rows = db
    .prepare(`
      SELECT i.*, c.name as category_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      ${whereClause}
      ORDER BY i.name COLLATE NOCASE ASC
      LIMIT ? OFFSET ?
    `)
    .all(...params, pageSize, offset) as ItemRow[]

  return {
    items: rows.map((r) => mapItemRow(r, getItemUnits(db, r.id))),
    total: countRow.total,
    page,
    pageSize
  }
}
