import Database from 'better-sqlite3'
import coreMigration001 from './migrations/001_core.sql?raw'
import coreMigration002 from './migrations/002_purchases.sql?raw'
import coreMigration003 from './migrations/003_sales.sql?raw'
import coreMigration004 from './migrations/004_cash.sql?raw'
import coreMigration005 from './migrations/005_reports.sql?raw'
import { nowLocal } from '@shared/dates'

export interface Migration {
  id: string
  sql: string
}

export const CORE_MIGRATIONS: Migration[] = [
  {
    id: '001_core',
    sql: coreMigration001
  },
  {
    id: '002_purchases',
    sql: coreMigration002
  },
  {
    id: '003_sales',
    sql: coreMigration003
  },
  {
    id: '004_cash',
    sql: coreMigration004
  },
  {
    id: '005_reports',
    sql: coreMigration005
  }
]

/**
 * Initializes schema_migrations tracking table if not present.
 */
export function initMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)
}

/**
 * Returns set of applied migration IDs.
 */
export function getAppliedMigrations(db: Database.Database): Set<string> {
  initMigrationsTable(db)
  const rows = db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: string }>
  return new Set(rows.map((r) => r.id))
}

/**
 * Applies a list of migrations inside transactions. Idempotent.
 */
export function applyMigrations(db: Database.Database, migrations: Migration[]): void {
  initMigrationsTable(db)
  const applied = getAppliedMigrations(db)

  for (const m of migrations) {
    if (applied.has(m.id)) {
      continue
    }

    const runInTransaction = db.transaction(() => {
      db.exec(m.sql)
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(m.id, nowLocal())
    })

    runInTransaction()
    applied.add(m.id)
  }
}

/**
 * Runs all core migrations on the given database. Idempotent.
 */
export function runMigrations(db: Database.Database): void {
  applyMigrations(db, CORE_MIGRATIONS)
}
