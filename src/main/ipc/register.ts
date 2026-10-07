import { app } from 'electron'
import { ok } from '@shared/result'
import type { MigrationStatus } from '@shared/ipc-contract'
import { handleIpc } from './handle'

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
}
