import type Database from 'better-sqlite3'
import type { AppSettings, SetupCompleteInput, SetupResult } from '@shared/types'
import { err, ok, type Result } from '@shared/result'
import { nowLocal } from '@shared/dates'
import { applyMigrations } from '../../db/migrate'
import { AVAILABLE_MODULES, getEnabledModuleIds, initModules } from '../../modules/registry'
import { hashPin, hasUsers } from '../users/service'
import { login } from '../auth/service'
import { storeNewRecoveryCode, RECOVERY_HASH_KEY } from '../auth/recovery'

/** Settings the renderer must never read or write directly. */
export const SECRET_SETTING_KEYS: string[] = [RECOVERY_HASH_KEY]

/**
 * Returns value for a specific setting key, or null if not found.
 */
export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row ? row.value : null
}

/**
 * Returns all settings as a key-value record.
 */
export function getAllSettings(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
    key: string
    value: string
  }>
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}

/**
 * Inserts or updates a single setting.
 */
export function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value)
}

/**
 * Inserts or updates multiple settings inside a single transaction.
 */
export function setSettings(db: Database.Database, settings: Record<string, string>): void {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)

  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, value)
    }
  })

  transaction()
}

/**
 * Checks whether the first-run wizard has been completed.
 */
export function isWizardCompleted(db: Database.Database): boolean {
  const val = getSetting(db, 'wizard_completed')
  return val === 'true'
}

/**
 * Returns typed application settings with sensible defaults.
 */
export function getAppSettings(db: Database.Database): AppSettings {
  const all = getAllSettings(db)
  return {
    shop_name: all['shop_name'] || '',
    shop_address: all['shop_address'] || '',
    shop_phone: all['shop_phone'] || '',
    receipt_footer: all['receipt_footer'] || '',
    printer_name: all['printer_name'] || '',
    paper_width: all['paper_width'] === '58mm' ? '58mm' : '80mm',
    language: all['language'] === 'ur' ? 'ur' : 'en',
    business_type: all['business_type'],
    wizard_completed: all['wizard_completed'] === 'true',
    enabled_modules: getEnabledModuleIds(db)
  }
}

/**
 * Completes the first-run wizard in a single atomic transaction.
 * 1. Rejects if any users already exist.
 * 2. Validates module IDs.
 * 3. In ONE transaction: applies migrations, saves settings + enabled_modules, creates owner user.
 * 4. Initializes modules and logs the owner in.
 */
export function completeSetup(
  db: Database.Database,
  input: SetupCompleteInput
): Result<SetupResult> {
  if (hasUsers(db)) {
    return err({
      code: 'ALREADY_SET_UP',
      message: 'Initial setup has already been completed'
    })
  }

  const uniqueModuleIds = Array.from(new Set(input.moduleIds || []))
  for (const id of uniqueModuleIds) {
    if (!AVAILABLE_MODULES[id]) {
      return err({
        code: 'UNKNOWN_MODULE',
        message: `Unknown module: ${id}`
      })
    }
  }

  try {
    const runTransaction = db.transaction((): SetupResult => {
      // 1. Apply module migrations
      for (const id of uniqueModuleIds) {
        const mod = AVAILABLE_MODULES[id]
        if (mod && mod.migrations && mod.migrations.length > 0) {
          applyMigrations(db, mod.migrations)
        }
      }

      // 2. Save settings
      const settingsToSave: Record<string, string> = {
        shop_name: input.shop.name.trim(),
        shop_address: input.shop.address?.trim() || '',
        shop_phone: input.shop.phone?.trim() || '',
        receipt_footer: input.receiptFooter?.trim() || '',
        printer_name: input.printerName?.trim() || '',
        paper_width: input.paperWidth || '80mm',
        language: input.language || 'en',
        enabled_modules: JSON.stringify(uniqueModuleIds),
        wizard_completed: 'true'
      }

      const settingStmt = db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)

      for (const [key, value] of Object.entries(settingsToSave)) {
        settingStmt.run(key, value)
      }

      // 3. Create owner user (forced to 'owner')
      const pinHash = hashPin(input.owner.pin)
      const createdAt = nowLocal()
      const trimmedName = input.owner.name.trim()
      const trimmedUsername = input.owner.username.trim().toLowerCase()

      const userStmt = db.prepare(`
        INSERT INTO users (name, username, pin_hash, role, active, created_at)
        VALUES (?, ?, ?, 'owner', 1, ?)
      `)

      const info = userStmt.run(trimmedName, trimmedUsername, pinHash, createdAt)

      // 4. Recovery code: only its hash is stored; the plain code is returned once.
      const recoveryCode = storeNewRecoveryCode(db)

      return {
        user: {
          id: Number(info.lastInsertRowid),
          name: trimmedName,
          username: trimmedUsername,
          role: 'owner',
          active: 1,
          createdAt
        },
        recoveryCode
      }
    })

    const result = runTransaction()

    initModules({ db })
    login(db, { userId: result.user.id, pin: input.owner.pin })

    return ok(result)
  } catch (error) {
    return err({
      code: 'SETUP_FAILED',
      message: error instanceof Error ? error.message : 'Setup transaction failed'
    })
  }
}
