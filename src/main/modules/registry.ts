import type Database from 'better-sqlite3'
import { applyMigrations } from '../db/migrate'
import { err, ok, type Result } from '@shared/result'
import type { MainModule, ModuleContext, StockAllocator } from './types'
import { pharmacyMainModule } from './pharmacy'

export const AVAILABLE_MODULES: Record<string, MainModule> = {
  pharmacy: pharmacyMainModule
}

let activeModules: MainModule[] = []
const registeredIpcModules = new Set<string>()

/**
 * Returns currently active main modules.
 */
export function getActiveModules(): MainModule[] {
  return activeModules
}

/**
 * Resets active modules and IPC registration tracking (for tests).
 */
export function resetRegisteredIpcModulesForTest(): void {
  activeModules = []
  registeredIpcModules.clear()
}

/**
 * Reads enabled module IDs from settings table.
 * Returns empty array if not configured or unparseable.
 */
export function getEnabledModuleIds(db: Database.Database): string[] {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'enabled_modules'").get() as
    | { value: string }
    | undefined

  if (!row || !row.value) {
    return []
  }

  try {
    const parsed = JSON.parse(row.value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Validates, migrates, and updates enabled module IDs in settings table.
 * - Deduplicates module IDs.
 * - Rejects any unknown module IDs with UNKNOWN_MODULE error.
 * - Applies migrations for enabled modules BEFORE writing to settings.
 * - If any migration fails, settings remains unchanged.
 */
export function setEnabledModuleIds(db: Database.Database, moduleIds: string[]): Result<void> {
  const uniqueIds = Array.from(new Set(moduleIds))

  for (const id of uniqueIds) {
    if (!AVAILABLE_MODULES[id]) {
      return err({ code: 'UNKNOWN_MODULE', message: `Unknown module: ${id}` })
    }
  }

  try {
    for (const id of uniqueIds) {
      const mod = AVAILABLE_MODULES[id]
      if (mod && mod.migrations && mod.migrations.length > 0) {
        applyMigrations(db, mod.migrations)
      }
    }
  } catch (error) {
    return err({
      code: 'MIGRATION_FAILED',
      message: error instanceof Error ? error.message : 'Module migration failed'
    })
  }

  const json = JSON.stringify(uniqueIds)
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES ('enabled_modules', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(json)

  return ok(undefined)
}

/**
 * Initializes all enabled modules:
 * 1. Reads enabled module IDs from settings.
 * 2. Runs each enabled module's migrations after core migrations.
 * 3. Registers module-specific IPC handlers (once per module).
 * 4. Replaces the active modules list in registry.
 * Core POS continues to work if zero modules are enabled.
 */
export function initModules(ctx: ModuleContext): MainModule[] {
  const enabledIds = getEnabledModuleIds(ctx.db)
  const nextActiveModules: MainModule[] = []

  for (const id of enabledIds) {
    const mod = AVAILABLE_MODULES[id]
    if (mod) {
      if (mod.migrations && mod.migrations.length > 0) {
        applyMigrations(ctx.db, mod.migrations)
      }
      if (!registeredIpcModules.has(mod.id)) {
        mod.registerIpc(ctx)
        registeredIpcModules.add(mod.id)
      }
      nextActiveModules.push(mod)
    }
  }

  activeModules = nextActiveModules
  return activeModules
}

/**
 * Returns the stock allocator of an active module, if one exists.
 */
export function getStockAllocator(modules: MainModule[] = activeModules): StockAllocator | undefined {
  for (const mod of modules) {
    if (mod.stockAllocator) {
      return mod.stockAllocator
    }
  }
  return undefined
}
