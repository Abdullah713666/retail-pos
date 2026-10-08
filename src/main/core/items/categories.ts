import type Database from 'better-sqlite3'
import { ok, err, type Result } from '@shared/result'
import type { Category } from '@shared/types'

export function listCategories(db: Database.Database): Category[] {
  return db
    .prepare(
      'SELECT id, name, active FROM categories WHERE active = 1 ORDER BY name COLLATE NOCASE ASC'
    )
    .all() as Category[]
}

export function createCategory(db: Database.Database, name: string): Result<Category> {
  const trimmed = name.trim()
  if (!trimmed) {
    return err({ code: 'INVALID_NAME', message: 'Category name is required' })
  }

  const existing = db
    .prepare('SELECT id, name, active FROM categories WHERE LOWER(name) = LOWER(?)')
    .get(trimmed) as Category | undefined

  if (existing) {
    if (existing.active === 0) {
      db.prepare('UPDATE categories SET active = 1 WHERE id = ?').run(existing.id)
      return ok({ id: existing.id, name: existing.name, active: 1 })
    }
    return err({ code: 'CATEGORY_EXISTS', message: 'Category already exists' })
  }

  const info = db.prepare('INSERT INTO categories (name, active) VALUES (?, 1)').run(trimmed)
  return ok({ id: Number(info.lastInsertRowid), name: trimmed, active: 1 })
}
