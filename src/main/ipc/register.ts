import { app, ipcMain } from 'electron'
import { ok } from '@shared/result'

export function registerIpcHandlers(): void {
  ipcMain.handle('ping', async () => {
    return ok('pong')
  })

  ipcMain.handle('app:getVersion', async () => {
    return ok(app.getVersion())
  })
}
