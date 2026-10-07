import { app } from 'electron'
import { z } from 'zod'
import { ok } from '@shared/result'
import type { MigrationStatus } from '@shared/ipc-contract'
import { handleIpc } from './handle'
import { getDb } from '../db/connection'
import { getEnabledModuleIds, setEnabledModuleIds, initModules } from '../modules/registry'

let currentMigrationStatus: MigrationStatus = { success: true, error: null }

export function setMigrationStatus(success: boolean, error: string | null = null): void {
  currentMigrationStatus = { success, error }
}

export function registerIpcHandlers(): void {
  handleIpc('ping', async () => {
    return ok('pong')
  })

  handleIpc('app:getVersion', async () => {
    return ok(app.getVersion())
  })

  handleIpc('db:getMigrationStatus', async () => {
    return ok(currentMigrationStatus)
  })

  handleIpc('modules:getEnabled', async () => {
    const db = getDb()
    const moduleIds = getEnabledModuleIds(db)
    return ok(moduleIds)
  })

  handleIpc('modules:setEnabled', z.array(z.string()), async (moduleIds) => {
    const db = getDb()
    const result = setEnabledModuleIds(db, moduleIds)
    if (!result.ok) {
      return result
    }
    initModules({ db })
    return ok(undefined)
  })
}
