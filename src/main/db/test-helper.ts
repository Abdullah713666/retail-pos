import Database from 'better-sqlite3'
import { openDb } from './connection'
import { runMigrations } from './migrate'

/**
 * Creates a fresh in-memory SQLite database with pragmas and core migrations applied.
 * Used for testing services and queries in isolated state.
 */
export function createTestDb(): Database.Database {
  const db = openDb(':memory:')
  runMigrations(db)
  return db
}
