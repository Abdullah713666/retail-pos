import { app } from 'electron'
import { z } from 'zod'
import { ok } from '@shared/result'
import type { MigrationStatus } from '@shared/ipc-contract'
import { handleIpc } from './handle'
import { getDb } from '../db/connection'
import { getEnabledModuleIds, setEnabledModuleIds, initModules } from '../modules/registry'
import {
  getSetting,
  getAllSettings,
  setSetting,
  setSettings,
  completeSetup
} from '../core/settings/service'
import {
  listUsers,
  createUser,
  deactivateUser,
  hasUsers
} from '../core/users/service'
import {
  login,
  logout,
  getCurrentUser,
  checkPermission
} from '../core/auth/service'

let currentMigrationStatus: MigrationStatus = { success: true, error: null }

export function setMigrationStatus(success: boolean, error: string | null = null): void {
  currentMigrationStatus = { success, error }
}

const setupCompleteSchema = z.object({
  shop: z.object({
    name: z.string().min(1),
    address: z.string().optional().default(''),
    phone: z.string().optional().default('')
  }),
  language: z.enum(['en', 'ur']).optional().default('en'),
  paperWidth: z.enum(['58mm', '80mm']).optional().default('80mm'),
  printerName: z.string().optional().default(''),
  receiptFooter: z.string().optional().default(''),
  moduleIds: z.array(z.string()),
  owner: z.object({
    name: z.string().min(1),
    username: z.string().min(1),
    pin: z.string().regex(/^\d{4,6}$/)
  })
})

export function registerIpcHandlers(): void {
  // App & Diagnostics
  handleIpc('ping', async () => ok('pong'))
  handleIpc('app:getVersion', async () => ok(app.getVersion()))
  handleIpc('db:getMigrationStatus', async () => ok(currentMigrationStatus))

  // Setup Wizard (Only allowed when no users exist)
  handleIpc('setup:complete', setupCompleteSchema, async (input) => {
    const db = getDb()
    return completeSetup(db, input)
  })

  // Modules (Owner only)
  handleIpc('modules:getEnabled', async () => {
    const db = getDb()
    return ok(getEnabledModuleIds(db))
  })

  handleIpc('modules:setEnabled', z.array(z.string()), async (moduleIds) => {
    const db = getDb()
    const perm = checkPermission(db, ['owner'])
    if (!perm.ok) return perm

    const result = setEnabledModuleIds(db, moduleIds)
    if (!result.ok) return result

    initModules({ db })
    return ok(undefined)
  })

  // Settings
  handleIpc('settings:getAll', async () => {
    const db = getDb()
    return ok(getAllSettings(db))
  })

  handleIpc('settings:get', z.string(), async (key) => {
    const db = getDb()
    return ok(getSetting(db, key))
  })

  handleIpc(
    'settings:set',
    z.object({ key: z.string().min(1), value: z.string() }),
    async ({ key, value }) => {
      const db = getDb()
      const perm = checkPermission(db, ['owner'])
      if (!perm.ok) return perm

      setSetting(db, key, value)
      return ok(undefined)
    }
  )

  handleIpc('settings:setMany', z.record(z.string()), async (settings) => {
    const db = getDb()
    const perm = checkPermission(db, ['owner'])
    if (!perm.ok) return perm

    setSettings(db, settings)
    return ok(undefined)
  })

  // Users
  handleIpc('users:list', async () => {
    const db = getDb()
    return ok(listUsers(db))
  })

  handleIpc(
    'users:create',
    z.object({
      name: z.string().min(1),
      username: z.string().min(1),
      pin: z.string().regex(/^\d{4,6}$/),
      role: z.enum(['owner', 'manager', 'cashier'])
    }),
    async (input) => {
      const db = getDb()
      const perm = checkPermission(db, ['owner'])
      if (!perm.ok) return perm

      const user = createUser(db, input)
      return ok(user)
    }
  )

  handleIpc('users:deactivate', z.number(), async (id) => {
    const db = getDb()
    const perm = checkPermission(db, ['owner'])
    if (!perm.ok) return perm

    deactivateUser(db, id)
    return ok(undefined)
  })

  // Auth
  handleIpc(
    'auth:login',
    z.object({
      userId: z.number().int().positive(),
      pin: z.string().regex(/^\d{4,6}$/)
    }),
    async (input) => {
      const db = getDb()
      return login(db, input)
    }
  )

  handleIpc('auth:logout', async () => {
    return logout()
  })

  handleIpc('auth:getCurrentUser', async () => {
    return ok(getCurrentUser())
  })

  handleIpc('auth:hasUsers', async () => {
    const db = getDb()
    return ok(hasUsers(db))
  })
}
