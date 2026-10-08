import type Database from 'better-sqlite3'
import { ok, type Result } from '@shared/result'
import { nowLocal } from '@shared/dates'
import { parseItemsCsv } from '@shared/csv'
import type { CsvPreviewResult, CsvImportResult } from '@shared/types'
import { logAudit } from '../audit/service'
import { listCategories } from './categories'

export function getAllExistingBarcodes(db: Database.Database): Set<string> {
  const rows = db
    .prepare(`
      SELECT barcode FROM items WHERE barcode IS NOT NULL AND barcode != ''
      UNION
      SELECT barcode FROM item_units WHERE barcode IS NOT NULL AND barcode != ''
    `)
    .all() as Array<{ barcode: string }>

  return new Set(rows.map((r) => r.barcode))
}

export function previewCsv(db: Database.Database, csvContent: string): Result<CsvPreviewResult> {
  const existingBarcodes = getAllExistingBarcodes(db)
  const preview = parseItemsCsv(csvContent, existingBarcodes)
  return ok(preview)
}

export function importCsv(
  db: Database.Database,
  csvContent: string,
  userId?: number | null
): Result<CsvImportResult> {
  // Re-parse on the main side: never trust rows sent from the renderer.
  const parsed = parseItemsCsv(csvContent, getAllExistingBarcodes(db))
  const rows = parsed.validRows
  const skippedCount = parsed.errors.length
  if (rows.length === 0) {
    return ok({ importedCount: 0, skippedCount })
  }

  const categoryCache = new Map<string, number>()
  for (const cat of listCategories(db)) {
    categoryCache.set(cat.name.toLowerCase(), cat.id)
  }

  const now = nowLocal()

  const runTx = db.transaction(() => {
    const insertCatStmt = db.prepare('INSERT INTO categories (name, active) VALUES (?, 1)')
    const insertItemStmt = db.prepare(`
      INSERT INTO items (
        name, search_text, barcode, category_id, base_unit,
        sale_price, cost_price, reorder_level, track_stock, track_lots,
        stock_cache, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, 0, 0, 1, ?, ?)
    `)
    const insertUnitStmt = db.prepare(`
      INSERT INTO item_units (item_id, name, factor, barcode, sale_price)
      VALUES (?, ?, ?, NULL, NULL)
    `)

    for (const r of rows) {
      let categoryId: number | null = null
      if (r.category && r.category.trim()) {
        const catName = r.category.trim()
        const lower = catName.toLowerCase()
        if (categoryCache.has(lower)) {
          categoryId = categoryCache.get(lower)!
        } else {
          const info = insertCatStmt.run(catName)
          categoryId = Number(info.lastInsertRowid)
          categoryCache.set(lower, categoryId)
        }
      }

      const searchText = r.name.toLowerCase().trim()
      const info = insertItemStmt.run(
        r.name.trim(),
        searchText,
        r.barcode || null,
        categoryId,
        r.baseUnit || 'pc',
        r.salePrice,
        r.costPrice,
        now,
        now
      )

      const itemId = Number(info.lastInsertRowid)

      if (r.packName && r.packFactor && r.packFactor >= 2) {
        insertUnitStmt.run(itemId, r.packName.trim(), r.packFactor)
      }
    }

    logAudit(db, {
      userId,
      action: 'items_imported',
      entity: 'items',
      details: { count: rows.length, skipped: skippedCount }
    })
  })

  runTx()
  return ok({ importedCount: rows.length, skippedCount })
}
