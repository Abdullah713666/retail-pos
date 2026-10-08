import type Database from 'better-sqlite3'
import { ok, err, type Result } from '@shared/result'

/** True if the barcode is used by any item or pack unit (other than excludeItemId's own). */
export function findBarcodeConflict(
  db: Database.Database,
  barcode: string,
  excludeItemId?: number
): boolean {
  const exclude = excludeItemId ?? 0
  const row = db
    .prepare(
      `SELECT 1 FROM items WHERE barcode = ? AND id != ?
       UNION
       SELECT 1 FROM item_units WHERE barcode = ? AND item_id != ?`
    )
    .get(barcode, exclude, barcode, exclude)
  return row !== undefined
}

/** Checks the item barcode and all unit barcodes for duplicates in the input and in the DB. */
export function checkBarcodes(
  db: Database.Database,
  itemBarcode: string | null,
  units: Array<{ barcode?: string | null }>,
  excludeItemId?: number
): Result<void> {
  const all: string[] = []
  if (itemBarcode) all.push(itemBarcode)
  for (const u of units) {
    const b = u.barcode?.trim()
    if (b) all.push(b)
  }

  const seen = new Set<string>()
  for (const b of all) {
    if (seen.has(b)) {
      return err({ code: 'BARCODE_EXISTS', message: `Barcode "${b}" is used more than once` })
    }
    seen.add(b)
  }

  for (const b of all) {
    if (findBarcodeConflict(db, b, excludeItemId)) {
      return err({ code: 'BARCODE_EXISTS', message: `Barcode "${b}" already exists` })
    }
  }
  return ok(undefined)
}
