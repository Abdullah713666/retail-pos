import type Database from 'better-sqlite3'
import { z } from 'zod'
import type { PharmacyItemInfo } from '@shared/types'
import { abort } from '../../db/tx'

const text = z.string().trim().max(120)
const infoSchema = z.object({
  genericName: text,
  manufacturer: text,
  strength: text,
  form: text,
  schedule: z.enum(['otc', 'rx', 'controlled']).nullable(),
  rack: text
})

interface InfoRow {
  generic_name: string | null
  manufacturer: string | null
  strength: string | null
  form: string | null
  schedule: PharmacyItemInfo['schedule']
  rack: string | null
}

export function getItemInfo(db: Database.Database, itemId: number): PharmacyItemInfo | null {
  const r = db.prepare('SELECT * FROM pharmacy_item_info WHERE item_id = ?').get(itemId) as InfoRow | undefined
  if (!r) return null
  return {
    genericName: r.generic_name ?? '',
    manufacturer: r.manufacturer ?? '',
    strength: r.strength ?? '',
    form: r.form ?? '',
    schedule: r.schedule,
    rack: r.rack ?? ''
  }
}

/** Called inside the item transaction: data.pharmacy is the form block. Empty form = no row. */
export function saveItemInfo(db: Database.Database, itemId: number, data: Record<string, unknown>): void {
  if (data.pharmacy === undefined) return
  const parsed = infoSchema.safeParse(data.pharmacy)
  if (!parsed.success) abort('INVALID_PHARMACY_INFO', 'Medicine details are not valid (text is too long?)')
  const i = parsed.data
  const empty = !i.genericName && !i.manufacturer && !i.strength && !i.form && !i.schedule && !i.rack
  if (empty) {
    db.prepare('DELETE FROM pharmacy_item_info WHERE item_id = ?').run(itemId)
    return
  }
  const n = (s: string): string | null => s || null
  db.prepare(
    `INSERT INTO pharmacy_item_info (item_id, generic_name, manufacturer, strength, form, schedule, rack)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET generic_name = excluded.generic_name, manufacturer = excluded.manufacturer,
       strength = excluded.strength, form = excluded.form, schedule = excluded.schedule, rack = excluded.rack`
  ).run(itemId, n(i.genericName), n(i.manufacturer), n(i.strength), n(i.form), i.schedule, n(i.rack))
}
