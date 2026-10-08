import { describe, it, expect } from 'vitest'
import { createTestDb } from './test-helper'
import { openDb } from './connection'
import { runMigrations, applyMigrations, getAppliedMigrations, CORE_MIGRATIONS } from './migrate'

describe('database migrations', () => {
  it('applies core migrations to an empty in-memory database', () => {
    const db = createTestDb()

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as Array<{ name: string }>

    const tableNames = tables.map((t) => t.name)

    const expectedTables = [
      'audit_log',
      'cash_entries',
      'cash_shifts',
      'categories',
      'item_units',
      'items',
      'parties',
      'party_ledger',
      'purchase_lines',
      'purchases',
      'sale_lines',
      'sales',
      'schema_migrations',
      'settings',
      'stock_lots',
      'stock_movements',
      'users'
    ]

    for (const expected of expectedTables) {
      expect(tableNames).toContain(expected)
    }

    db.close()
  })

  it('enforces SQLite pragmas (foreign keys on, busy timeout)', () => {
    const db = createTestDb()

    const foreignKeys = db.pragma('foreign_keys', { simple: true })
    const busyTimeout = db.pragma('busy_timeout', { simple: true })

    expect(foreignKeys).toBe(1)
    expect(busyTimeout).toBe(5000)

    // Inserting an item with invalid category_id should violate foreign key constraint
    expect(() => {
      db.prepare(`
        INSERT INTO items (
          name, search_text, barcode, category_id, base_unit,
          sale_price, cost_price, reorder_level, track_stock, track_lots,
          stock_cache, active, created_at, updated_at
        ) VALUES (
          'Test Item', 'test item', '9999', 999999, 'pc',
          100, 80, 0, 1, 0,
          0, 1, '2026-10-08 00:00:00', '2026-10-08 00:00:00'
        )
      `).run()
    }).toThrow(/FOREIGN KEY constraint failed/i)

    db.close()
  })

  it('allows null invoice_no for held bills in sales table', () => {
    const db = createTestDb()

    db.prepare(`
      INSERT INTO users (id, name, username, pin_hash, role, created_at)
      VALUES (1, 'Cashier', 'cashier1', 'hash', 'cashier', '2026-10-08 00:00:00')
    `).run()

    expect(() => {
      db.prepare(`
        INSERT INTO sales (
          invoice_no, user_id, status, subtotal, discount, total, paid_cash, paid_credit, created_at
        ) VALUES (
          NULL, 1, 'held', 500, 0, 500, 0, 0, '2026-10-08 00:00:00'
        )
      `).run()
    }).not.toThrow()

    db.close()
  })

  it('is completely idempotent when run multiple times', () => {
    const db = createTestDb()

    // Run migrations again on the same DB
    expect(() => runMigrations(db)).not.toThrow()

    const applied = getAppliedMigrations(db)
    expect(applied.has('001_core')).toBe(true)

    const count = db.prepare("SELECT count(*) as count FROM schema_migrations WHERE id = '001_core'").get() as {
      count: number
    }
    expect(count.count).toBe(1)

    db.close()
  })

  it('rolls back on failure: throws, is not recorded, and leaves no partial tables', () => {
    const db = openDb(':memory:')

    const failingMigrations = [
      {
        id: 'partial_fail',
        sql: `
          CREATE TABLE partial_test_table (id INTEGER PRIMARY KEY);
          INVALID SQL STATEMENT CRASH;
        `
      }
    ]

    expect(() => applyMigrations(db, failingMigrations)).toThrow()

    // Not recorded in schema_migrations
    const applied = getAppliedMigrations(db)
    expect(applied.has('partial_fail')).toBe(false)

    // Table created before error must be rolled back completely
    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='partial_test_table'")
      .get()
    expect(tableCheck).toBeUndefined()

    db.close()
  })

  it('005 fills sale_lines.cost_total for sales that already existed (lot chunks, else item cost)', () => {
    const db = openDb(':memory:')
    applyMigrations(db, CORE_MIGRATIONS.slice(0, 4))
    db.exec(`
      INSERT INTO users (id, name, username, pin_hash, role, active, created_at) VALUES (1, 'o', 'o', 'x', 'owner', 1, 'now');
      INSERT INTO items (id, name, search_text, base_unit, sale_price, cost_price, created_at, updated_at)
        VALUES (1, 'A', 'a', 'pc', 500, 300, 'now', 'now'), (2, 'B', 'b', 'pc', 500, 200, 'now', 'now');
      INSERT INTO sales (id, invoice_no, user_id, status, subtotal, total, created_at) VALUES (1, 'INV-1', 1, 'completed', 0, 0, 'now');
      INSERT INTO sale_lines (id, sale_id, item_id, unit_name, unit_factor, qty, qty_base, unit_price, line_total)
        VALUES (1, 1, 1, 'pc', 1, 5, 5, 500, 2500), (2, 1, 2, 'pc', 1, 4, 4, 500, 2000);
      INSERT INTO sale_line_lots (sale_line_id, lot_id, qty_base, cost_price) VALUES (1, NULL, 2, 100), (1, NULL, 3, 110);
    `)
    applyMigrations(db, CORE_MIGRATIONS)
    const cost = (id: number): number => (db.prepare('SELECT cost_total AS c FROM sale_lines WHERE id = ?').get(id) as { c: number }).c
    expect(cost(1)).toBe(2 * 100 + 3 * 110)
    expect(cost(2)).toBe(4 * 200)
  })
})
