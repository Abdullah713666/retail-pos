import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestDb } from '../db/test-helper'
import {
  getEnabledModuleIds,
  setEnabledModuleIds,
  initModules,
  getActiveModules,
  getStockAllocator,
  resetRegisteredIpcModulesForTest,
  AVAILABLE_MODULES
} from './registry'
import type { MainModule } from './types'

describe('Module registry', () => {
  beforeEach(() => {
    resetRegisteredIpcModulesForTest()
  })

  afterEach(() => {
    delete AVAILABLE_MODULES['broken_module']
    delete AVAILABLE_MODULES['custom_alloc']
  })

  describe('getEnabledModuleIds & setEnabledModuleIds', () => {
    it('returns empty array when enabled_modules is not set', () => {
      const db = createTestDb()
      expect(getEnabledModuleIds(db)).toEqual([])
    })

    it('returns empty array for invalid or non-array JSON', () => {
      const db = createTestDb()
      db.prepare("INSERT INTO settings (key, value) VALUES ('enabled_modules', 'not-json')").run()
      expect(getEnabledModuleIds(db)).toEqual([])

      db.prepare("UPDATE settings SET value = '{\"key\":\"value\"}' WHERE key = 'enabled_modules'").run()
      expect(getEnabledModuleIds(db)).toEqual([])
    })

    it('sets and gets enabled module IDs correctly', () => {
      const db = createTestDb()
      const res = setEnabledModuleIds(db, ['pharmacy'])
      expect(res.ok).toBe(true)
      expect(getEnabledModuleIds(db)).toEqual(['pharmacy'])

      // Overwrite on conflict
      const res2 = setEnabledModuleIds(db, [])
      expect(res2.ok).toBe(true)
      expect(getEnabledModuleIds(db)).toEqual([])
    })

    it('removes duplicate module IDs when setting enabled modules', () => {
      const db = createTestDb()
      const res = setEnabledModuleIds(db, ['pharmacy', 'pharmacy'])
      expect(res.ok).toBe(true)
      expect(getEnabledModuleIds(db)).toEqual(['pharmacy'])
    })

    it('rejects unknown module IDs with UNKNOWN_MODULE code and leaves settings unchanged', () => {
      const db = createTestDb()
      const res = setEnabledModuleIds(db, ['non_existent_module'])
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error.code).toBe('UNKNOWN_MODULE')
        expect(res.error.message).toContain('non_existent_module')
      }
      expect(getEnabledModuleIds(db)).toEqual([])
    })

    it('runs migrations before saving setting; leaves enabled_modules unchanged if migration fails', () => {
      const db = createTestDb()

      // Register a module with invalid migration SQL
      AVAILABLE_MODULES['broken_module'] = {
        id: 'broken_module',
        migrations: [
          {
            id: 'broken/001',
            sql: 'THIS IS INVALID SQL STATEMENT;'
          }
        ],
        registerIpc: () => {}
      }

      // 1. Initial attempt on clean DB
      const failRes = setEnabledModuleIds(db, ['broken_module'])
      expect(failRes.ok).toBe(false)
      if (!failRes.ok) {
        expect(failRes.error.code).toBe('MIGRATION_FAILED')
      }
      expect(getEnabledModuleIds(db)).toEqual([])

      // Verify broken migration was rolled back and not recorded
      const row = db.prepare("SELECT id FROM schema_migrations WHERE id = 'broken/001'").get()
      expect(row).toBeUndefined()

      // 2. Previously enabled module stays enabled if adding a broken module fails
      const enableOk = setEnabledModuleIds(db, ['pharmacy'])
      expect(enableOk.ok).toBe(true)
      expect(getEnabledModuleIds(db)).toEqual(['pharmacy'])

      const failSecond = setEnabledModuleIds(db, ['pharmacy', 'broken_module'])
      expect(failSecond.ok).toBe(false)
      expect(getEnabledModuleIds(db)).toEqual(['pharmacy'])
    })
  })

  describe('getActiveModules & initModules', () => {
    it('handles zero modules enabled cleanly', () => {
      const db = createTestDb()
      setEnabledModuleIds(db, [])

      const active = initModules({ db })
      expect(active).toEqual([])
      expect(getActiveModules()).toEqual([])

      // Core tables still exist
      const itemsCount = db.prepare('SELECT count(*) as count FROM items').get() as { count: number }
      expect(itemsCount.count).toBe(0)
    })

    it('stores active modules in registry and replaces (not appends) on disable', () => {
      const db = createTestDb()
      expect(getActiveModules()).toEqual([])

      // Enable pharmacy
      setEnabledModuleIds(db, ['pharmacy'])
      initModules({ db })
      expect(getActiveModules().map((m) => m.id)).toEqual(['pharmacy'])

      // Disable pharmacy
      setEnabledModuleIds(db, [])
      initModules({ db })
      expect(getActiveModules()).toEqual([])
    })

    it('applies pharmacy migrations when pharmacy is enabled', () => {
      const db = createTestDb()
      setEnabledModuleIds(db, ['pharmacy'])

      const active = initModules({ db })
      expect(active.length).toBe(1)
      expect(active[0].id).toBe('pharmacy')

      // Verify migration recorded
      const migrationRow = db
        .prepare("SELECT id FROM schema_migrations WHERE id = 'pharmacy/001_init'")
        .get() as { id: string } | undefined
      expect(migrationRow).toBeDefined()
      expect(migrationRow?.id).toBe('pharmacy/001_init')

      // Verify pharmacy_item_info table was created
      const tableCheck = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pharmacy_item_info'")
        .get() as { name: string } | undefined
      expect(tableCheck).toBeDefined()
      expect(tableCheck?.name).toBe('pharmacy_item_info')
    })

    it('is idempotent when run multiple times', () => {
      const db = createTestDb()
      setEnabledModuleIds(db, ['pharmacy'])

      const firstRun = initModules({ db })
      expect(firstRun.length).toBe(1)

      const secondRun = initModules({ db })
      expect(secondRun.length).toBe(1)

      const count = db
        .prepare("SELECT count(*) as count FROM schema_migrations WHERE id = 'pharmacy/001_init'")
        .get() as { count: number }
      expect(count.count).toBe(1)
    })

    it('gracefully skips unknown module IDs in settings during initModules', () => {
      const db = createTestDb()
      db.prepare(`
        INSERT INTO settings (key, value)
        VALUES ('enabled_modules', '["unknown_mod", "pharmacy"]')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run()

      const active = initModules({ db })
      expect(active.length).toBe(1)
      expect(active[0].id).toBe('pharmacy')
    })

    it('verifies pharmacy_item_info table foreign keys and cascade delete', () => {
      const db = createTestDb()
      setEnabledModuleIds(db, ['pharmacy'])
      initModules({ db })

      // Insert an item in core items table
      db.prepare(`
        INSERT INTO items (
          id, name, search_text, base_unit, sale_price, cost_price, created_at, updated_at
        ) VALUES (1, 'Panadol 500mg', 'panadol 500mg', 'tablet', 300, 200, '2026-10-08 12:00:00', '2026-10-08 12:00:00')
      `).run()

      // Insert pharmacy info referencing item 1
      db.prepare(`
        INSERT INTO pharmacy_item_info (
          item_id, generic_name, manufacturer, strength, form, schedule, rack
        ) VALUES (1, 'Paracetamol', 'GSK', '500mg', 'Tablet', 'otc', 'A-12')
      `).run()

      const row = db.prepare('SELECT * FROM pharmacy_item_info WHERE item_id = 1').get() as {
        generic_name: string
        schedule: string
        rack: string
      }
      expect(row.generic_name).toBe('Paracetamol')
      expect(row.schedule).toBe('otc')
      expect(row.rack).toBe('A-12')

      // Delete parent item; child pharmacy_item_info should cascade delete
      db.prepare('DELETE FROM items WHERE id = 1').run()
      const afterDelete = db.prepare('SELECT * FROM pharmacy_item_info WHERE item_id = 1').get()
      expect(afterDelete).toBeUndefined()
    })
  })

  describe('getStockAllocator', () => {
    it('returns undefined if no active module provides an allocator', () => {
      const db = createTestDb()
      setEnabledModuleIds(db, ['pharmacy'])
      initModules({ db })

      // Call without parameters - uses activeModules from registry
      expect(getStockAllocator()).toBeUndefined()
      // Call with explicit array
      expect(getStockAllocator([AVAILABLE_MODULES.pharmacy])).toBeUndefined()
    })

    it('returns allocator if an active module provides one', () => {
      const dummyAllocator = {
        allocate: () => []
      }
      const customModule: MainModule = {
        id: 'custom_alloc',
        migrations: [],
        registerIpc: () => {},
        stockAllocator: dummyAllocator
      }
      AVAILABLE_MODULES['custom_alloc'] = customModule

      const db = createTestDb()
      setEnabledModuleIds(db, ['custom_alloc'])
      initModules({ db })

      // Call without parameters - resolves from activeModules
      expect(getStockAllocator()).toBe(dummyAllocator)
      // Call with explicit array
      expect(getStockAllocator([customModule])).toBe(dummyAllocator)
    })
  })
})
