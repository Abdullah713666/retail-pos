import { describe, it, expect, afterEach, vi } from 'vitest'

// Enabling the pharmacy module registers its IPC handlers; there is no Electron in tests.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))
import { createTestDb } from '../../db/test-helper'
import { AVAILABLE_MODULES } from '../../modules/registry'
import {
  getSetting,
  getAllSettings,
  setSetting,
  setSettings,
  isWizardCompleted,
  getAppSettings,
  completeSetup
} from './service'

describe('Settings service', () => {
  afterEach(() => {
    delete AVAILABLE_MODULES['broken_setup']
  })

  it('returns null for nonexistent setting', () => {
    const db = createTestDb()
    expect(getSetting(db, 'nonexistent')).toBeNull()
  })

  it('sets and gets setting', () => {
    const db = createTestDb()
    setSetting(db, 'shop_name', 'Test Pharmacy')
    expect(getSetting(db, 'shop_name')).toBe('Test Pharmacy')

    // update
    setSetting(db, 'shop_name', 'Updated Pharmacy')
    expect(getSetting(db, 'shop_name')).toBe('Updated Pharmacy')
  })

  it('sets multiple settings atomically in transaction', () => {
    const db = createTestDb()
    setSettings(db, {
      shop_name: 'Metro Mart',
      shop_phone: '03001234567',
      paper_width: '58mm'
    })

    const all = getAllSettings(db)
    expect(all['shop_name']).toBe('Metro Mart')
    expect(all['shop_phone']).toBe('03001234567')
    expect(all['paper_width']).toBe('58mm')
  })

  it('reports wizard completion correctly', () => {
    const db = createTestDb()
    expect(isWizardCompleted(db)).toBe(false)

    setSetting(db, 'wizard_completed', 'true')
    expect(isWizardCompleted(db)).toBe(true)
  })

  it('returns typed AppSettings with defaults', () => {
    const db = createTestDb()
    const defaults = getAppSettings(db)
    expect(defaults.shop_name).toBe('')
    expect(defaults.paper_width).toBe('80mm')
    expect(defaults.language).toBe('en')
    expect(defaults.wizard_completed).toBe(false)
    expect(defaults.enabled_modules).toEqual([])

    setSettings(db, {
      shop_name: 'Super Store',
      language: 'ur',
      paper_width: '58mm',
      wizard_completed: 'true'
    })

    const updated = getAppSettings(db)
    expect(updated.shop_name).toBe('Super Store')
    expect(updated.language).toBe('ur')
    expect(updated.paper_width).toBe('58mm')
    expect(updated.wizard_completed).toBe(true)
  })

  describe('completeSetup', () => {
    it('successfully completes initial setup in one transaction', () => {
      const db = createTestDb()
      const res = completeSetup(db, {
        shop: {
          name: 'Al-Madina Pharmacy',
          address: 'Main Bazar, Lahore',
          phone: '0300-1122334'
        },
        language: 'ur',
        paperWidth: '80mm',
        printerName: 'POS-80',
        receiptFooter: 'JazakAllah Khair',
        moduleIds: ['pharmacy'],
        owner: {
          name: 'Abdullah',
          username: 'owner',
          pin: '1234'
        }
      })

      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.data.name).toBe('Abdullah')
        expect(res.data.username).toBe('owner')
        expect(res.data.role).toBe('owner')
        expect(res.data.active).toBe(1)
      }

      // Settings were saved
      const all = getAllSettings(db)
      expect(all['shop_name']).toBe('Al-Madina Pharmacy')
      expect(all['language']).toBe('ur')
      expect(all['wizard_completed']).toBe('true')
      expect(all['enabled_modules']).toBe('["pharmacy"]')

      // Module migration ran
      const tableCheck = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pharmacy_item_info'")
        .get()
      expect(tableCheck).toBeDefined()
    })

    it('rejects second setup call with ALREADY_SET_UP', () => {
      const db = createTestDb()
      const first = completeSetup(db, {
        shop: { name: 'Shop 1' },
        moduleIds: [],
        owner: { name: 'Owner', username: 'owner', pin: '1234' }
      })
      expect(first.ok).toBe(true)

      const second = completeSetup(db, {
        shop: { name: 'Shop 2' },
        moduleIds: [],
        owner: { name: 'Hacker', username: 'hacker', pin: '9999' }
      })
      expect(second.ok).toBe(false)
      if (!second.ok) {
        expect(second.error.code).toBe('ALREADY_SET_UP')
      }
    })

    it('rolls back completely if module migration fails, leaving zero users and no settings saved', () => {
      const db = createTestDb()

      AVAILABLE_MODULES['broken_setup'] = {
        id: 'broken_setup',
        migrations: [
          {
            id: 'broken/001',
            sql: 'INVALID SQL STATEMENT;'
          }
        ],
        registerIpc: () => {}
      }

      const res = completeSetup(db, {
        shop: { name: 'Broken Shop' },
        moduleIds: ['broken_setup'],
        owner: { name: 'Owner', username: 'owner', pin: '1234' }
      })

      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error.code).toBe('SETUP_FAILED')
      }

      // Assert zero users exist
      const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number }
      expect(userCount.count).toBe(0)

      // Assert no settings were saved
      const settingsCount = db.prepare('SELECT count(*) as count FROM settings').get() as { count: number }
      expect(settingsCount.count).toBe(0)

      // Assert no partial migrations recorded
      const migration = db.prepare("SELECT id FROM schema_migrations WHERE id = 'broken/001'").get()
      expect(migration).toBeUndefined()
    })
  })
})
