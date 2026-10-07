import Database from 'better-sqlite3'
import { app } from 'electron'
import { dirname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let activeDb: Database.Database | null = null

/**
 * Returns the default file path for the SQLite database.
 * Lives in app.getPath('userData')/data/shop.db per ARCHITECTURE §5.
 */
export function getDbPath(): string {
  try {
    if (app && typeof app.getPath === 'function') {
      return join(app.getPath('userData'), 'data', 'shop.db')
    }
  } catch {
    // Fallback if app is not initialized yet or in non-electron test context
  }
  return join(process.cwd(), 'data', 'shop.db')
}

/**
 * Opens and configures a SQLite database instance with the required pragmas.
 * Pragmas: WAL journal mode, FULL synchronous, foreign keys enabled, 5000ms busy timeout.
 */
export function openDb(customPath?: string): Database.Database {
  const dbPath = customPath || getDbPath()

  if (dbPath !== ':memory:') {
    const dir = dirname(dbPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  const db = new Database(dbPath)

  // SQLite pragmas per ARCHITECTURE §5
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = FULL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  if (!customPath) {
    activeDb = db
  }

  return db
}

/**
 * Returns the active singleton database connection or opens one if not yet initialized.
 */
export function getDb(): Database.Database {
  if (!activeDb) {
    activeDb = openDb()
  }
  return activeDb
}

/**
 * Closes the active database connection if open.
 */
export function closeDb(): void {
  if (activeDb) {
    activeDb.close()
    activeDb = null
  }
}
