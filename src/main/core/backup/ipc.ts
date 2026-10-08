import { app, BrowserWindow, dialog, type OpenDialogOptions, type OpenDialogReturnValue } from 'electron'
import { basename, join } from 'path'
import { z } from 'zod'
import { err, ok } from '@shared/result'
import { handleIpc } from '../../ipc/handle'
import { closeDb, getDb, getDbPath } from '../../db/connection'
import { runMigrations } from '../../db/migrate'
import { initModules } from '../../modules/registry'
import { checkPermission, getCurrentUser } from '../auth/service'
import { getSetting, setSetting } from '../settings/service'
import { logAudit } from '../audit/service'
import {
  BACKUP_NAME, createBackup, getBackupKeep, listBackups, restoreFromFile, runAutoBackup, validateBackupFile
} from './service'

const OWNER = ['owner' as const]
const backupDir = (): string => join(app.getPath('userData'), 'backups')
const extraDir = (): string => getSetting(getDb(), 'backup_extra_dir') ?? ''

/** The one file the owner picked in the file dialog; restore only accepts this, never a renderer-sent path. */
let pickedFile: string | null = null

function showOpen(o: OpenDialogOptions): Promise<OpenDialogReturnValue> {
  const win = BrowserWindow.getFocusedWindow()
  return win ? dialog.showOpenDialog(win, o) : dialog.showOpenDialog(o)
}

/** Daily backup, a few seconds after launch so start-up stays fast. Never throws. */
export async function runStartupBackup(): Promise<void> {
  try {
    const res = await runAutoBackup(getDb(), 'startup', { dir: backupDir(), extraDir: extraDir() })
    if (!res.ok) console.error(res.error.message)
  } catch (e) {
    console.error('Startup backup failed:', e)
  }
}

/** Backup when the app closes (only if something changed). Never throws. */
export async function runCloseBackup(): Promise<void> {
  try {
    const res = await runAutoBackup(getDb(), 'close', { dir: backupDir(), extraDir: extraDir() })
    if (!res.ok) console.error(res.error.message)
  } catch (e) {
    console.error('Close backup failed:', e)
  }
}

function relaunch(): void {
  app.relaunch()
  // Let the IPC reply reach the window before the process goes away.
  setTimeout(() => app.exit(0), 600)
}

export function registerBackupIpc(): void {
  handleIpc('backup:status', async () => {
    const perm = checkPermission(OWNER)
    if (!perm.ok) return perm
    const db = getDb()
    return ok({
      backupDir: backupDir(),
      lastBackupAt: getSetting(db, 'last_backup_at'),
      extraDir: extraDir(),
      keep: getBackupKeep(db),
      backups: listBackups(backupDir())
    })
  })

  handleIpc('backup:now', async () => {
    const perm = checkPermission(OWNER)
    if (!perm.ok) return perm
    const db = getDb()
    const res = await createBackup(db, { dir: backupDir(), extraDir: extraDir() })
    if (res.ok) logAudit(db, { userId: getCurrentUser()?.id, action: 'backup_created', entity: 'database', details: { name: res.data.name } })
    return res
  })

  handleIpc('backup:chooseExtraDir', async () => {
    const perm = checkPermission(OWNER)
    if (!perm.ok) return perm
    const res = await showOpen({ properties: ['openDirectory', 'createDirectory'] })
    if (res.canceled || res.filePaths.length === 0) return ok(null)
    setSetting(getDb(), 'backup_extra_dir', res.filePaths[0])
    return ok(res.filePaths[0])
  })

  handleIpc('backup:clearExtraDir', async () => {
    const perm = checkPermission(OWNER)
    if (!perm.ok) return perm
    setSetting(getDb(), 'backup_extra_dir', '')
    return ok(undefined)
  })

  handleIpc('backup:pickFile', async () => {
    const perm = checkPermission(OWNER)
    if (!perm.ok) return perm
    pickedFile = null
    const res = await showOpen({
      defaultPath: backupDir(),
      properties: ['openFile'],
      filters: [{ name: 'Backup', extensions: ['db'] }]
    })
    if (res.canceled || res.filePaths.length === 0) return ok(null)
    const valid = validateBackupFile(res.filePaths[0])
    if (!valid.ok) return valid
    pickedFile = res.filePaths[0]
    return ok({ fileName: basename(pickedFile) })
  })

  handleIpc('backup:restore', z.object({ name: z.string().max(200).optional() }), async (input) => {
    const perm = checkPermission(OWNER)
    if (!perm.ok) return perm
    let source: string | null
    if (input.name !== undefined) {
      if (!BACKUP_NAME.test(input.name)) return err({ code: 'INVALID_BACKUP', message: 'Unknown backup file' })
      source = join(backupDir(), input.name)
    } else {
      source = pickedFile
    }
    if (!source) return err({ code: 'NO_FILE', message: 'Choose a backup file first' })
    pickedFile = null

    const user = getCurrentUser()
    const res = await restoreFromFile(getDb(), source, {
      dbPath: getDbPath(),
      backupDir: backupDir(),
      userId: user?.id ?? null,
      userName: user?.name ?? '',
      close: closeDb,
      open: () => {
        const db = getDb()
        runMigrations(db)
        initModules({ db })
        return db
      }
    })
    if (res.ok || res.error.code === 'RESTORE_FAILED_RELAUNCH') relaunch()
    return res.ok ? ok(undefined) : res
  })
}
