/**
 * Backup & restore (ARCHITECTURE §10).
 *
 * Power-cut safety: a backup is written to `<name>.tmp` (SQLite online backup API, never a copy of
 * the live file), verified, and only then renamed to its final name. A half-written file can
 * therefore never look like a good backup; leftover .tmp files are cleaned up on the next run.
 * Restore validates the chosen file first, takes a safety backup of the current data, and swaps
 * the database file with a rename.
 */
import Database from 'better-sqlite3'
import {
  closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readSync, readdirSync, renameSync,
  statSync, unlinkSync
} from 'fs'
import { join } from 'path'
import { err, ok, type Result } from '@shared/result'
import { formatLocalDate, nowLocal } from '@shared/dates'
import type { BackupFile, BackupNowResult } from '@shared/types'
import { CORE_MIGRATIONS } from '../../db/migrate'
import { getSetting, setSetting } from '../settings/service'
import { logAudit } from '../audit/service'

export const BACKUP_NAME = /^shop-\d{8}-\d{4}(-\d+)?\.db$/
export const DEFAULT_KEEP = 30
const SQLITE_HEADER = 'SQLite format 3\0'
const REQUIRED_TABLES = [
  'settings', 'users', 'items', 'stock_movements', 'party_ledger', 'sales', 'sale_lines', 'audit_log',
  'schema_migrations'
]
/** Tables whose newest id changes whenever shop data changes; used to skip pointless close-time backups. */
const MARKER_TABLES = ['sales', 'sale_returns', 'purchases', 'stock_movements', 'party_ledger', 'cash_entries', 'audit_log', 'items']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function backupFileName(d: Date, taken: (name: string) => boolean): string {
  const base = `shop-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  let name = `${base}.db`
  for (let i = 2; taken(name); i++) name = `${base}-${i}.db`
  return name
}

function fsyncFile(path: string): void {
  const fd = openSync(path, 'r+')
  try {
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}

function removeTmpFiles(dir: string): void {
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir)) if (f.endsWith('.tmp')) safeUnlink(join(dir, f))
}

function safeUnlink(path: string): void {
  try {
    unlinkSync(path)
  } catch {
    /* a file in use is retried on the next run */
  }
}

export function listBackups(dir: string): BackupFile[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => BACKUP_NAME.test(f))
    .map((name) => {
      const st = statSync(join(dir, name))
      return { name, size: st.size, modifiedAt: st.mtime.toISOString() }
    })
    .sort((a, b) => b.name.localeCompare(a.name))
}

/** Keeps the newest `keep` backups (by file name, which sorts by date) and deletes the rest. */
export function rotateBackups(dir: string, keep: number): number {
  const old = listBackups(dir).slice(Math.max(1, keep))
  for (const f of old) safeUnlink(join(dir, f.name))
  return old.length
}

/**
 * Checks a freshly written backup end to end. It is also switched to the plain rollback journal so
 * the backup is ONE self-contained file (no -wal/-shm beside it) that is safe to copy to a USB stick.
 */
function verifyFile(path: string): void {
  const check = new Database(path, { fileMustExist: true })
  try {
    check.pragma('journal_mode = DELETE')
    const rows = check.pragma('integrity_check') as Array<{ integrity_check: string }>
    if (rows.length !== 1 || rows[0].integrity_check !== 'ok') throw new Error('integrity check failed')
  } finally {
    check.close()
  }
}

function dataMarker(db: Database.Database): string {
  return MARKER_TABLES.map((t) => (db.prepare(`SELECT COALESCE(MAX(id), 0) AS m FROM ${t}`).get() as { m: number }).m).join('.')
}

export function getBackupKeep(db: Database.Database): number {
  const n = parseInt(getSetting(db, 'backup_keep') ?? '', 10)
  return Number.isFinite(n) && n >= 1 && n <= 365 ? n : DEFAULT_KEEP
}

export interface BackupOptions {
  dir: string
  extraDir?: string
  keep?: number
  now?: Date
}

/** Online backup into `dir`, optional copy into `extraDir`, then rotation in both. */
export async function createBackup(db: Database.Database, opts: BackupOptions): Promise<Result<BackupNowResult>> {
  const keep = opts.keep ?? getBackupKeep(db)
  try {
    mkdirSync(opts.dir, { recursive: true })
    removeTmpFiles(opts.dir)
    const name = backupFileName(opts.now ?? new Date(), (n) => existsSync(join(opts.dir, n)))
    const tmp = join(opts.dir, `${name}.tmp`)
    try {
      await db.backup(tmp)
      verifyFile(tmp)
      fsyncFile(tmp)
      renameSync(tmp, join(opts.dir, name))
    } catch (e) {
      safeUnlink(tmp)
      throw e
    }
    rotateBackups(opts.dir, keep)

    let extraError: string | null = null
    if (opts.extraDir?.trim()) {
      try {
        mkdirSync(opts.extraDir, { recursive: true })
        removeTmpFiles(opts.extraDir)
        const extraTmp = join(opts.extraDir, `${name}.tmp`)
        try {
          copyFileSync(join(opts.dir, name), extraTmp)
          fsyncFile(extraTmp)
          renameSync(extraTmp, join(opts.extraDir, name))
        } catch (e) {
          safeUnlink(extraTmp)
          throw e
        }
        rotateBackups(opts.extraDir, keep)
      } catch (e) {
        extraError = (e as Error).message
      }
    }
    setSetting(db, 'last_backup_at', nowLocal())
    setSetting(db, 'last_backup_marker', dataMarker(db))
    return ok({ name, extraError })
  } catch (e) {
    return err({ code: 'BACKUP_FAILED', message: `Backup failed: ${(e as Error).message}` })
  }
}

/**
 * Automatic backups: 'startup' runs once per calendar day; 'close' runs only when shop data changed
 * since the last backup, so a busy day does not push the daily history out of the "keep N" window.
 */
export async function runAutoBackup(
  db: Database.Database, reason: 'startup' | 'close', opts: Omit<BackupOptions, 'extraDir'> & { extraDir?: string }
): Promise<Result<BackupNowResult | null>> {
  if (reason === 'startup') {
    const last = getSetting(db, 'last_backup_at')
    if (last && last.slice(0, 10) === formatLocalDate(opts.now ?? new Date())) return ok(null)
  } else if (getSetting(db, 'last_backup_marker') === dataMarker(db)) {
    return ok(null)
  }
  return createBackup(db, opts)
}

export type BackupValidation = Result<{ migrations: number }>

/** Is this file a healthy database of THIS app (and not from a newer version)? */
export function validateBackupFile(path: string): BackupValidation {
  const bad = (message: string): BackupValidation => err({ code: 'INVALID_BACKUP', message })
  try {
    const fd = openSync(path, 'r')
    const head = Buffer.alloc(16)
    try {
      readSync(fd, head, 0, 16, 0)
    } finally {
      closeSync(fd)
    }
    if (head.toString('latin1') !== SQLITE_HEADER) return bad('This file is not a backup of this app (not a database).')
  } catch {
    return bad('Could not read that file.')
  }

  let check: Database.Database | null = null
  try {
    check = new Database(path, { readonly: true, fileMustExist: true })
    const rows = check.pragma('integrity_check') as Array<{ integrity_check: string }>
    if (rows.length !== 1 || rows[0].integrity_check !== 'ok') return bad('This backup file is damaged.')
    const tables = new Set(
      (check.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((r) => r.name)
    )
    if (REQUIRED_TABLES.some((t) => !tables.has(t))) return bad('This database does not belong to this app.')
    const applied = (check.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: string }>).map((r) => r.id)
    const known = new Set(CORE_MIGRATIONS.map((m) => m.id))
    const core = applied.filter((id) => !id.includes('/'))
    if (core.some((id) => !known.has(id))) return bad('This backup was made by a newer version of the app. Update the app first.')
    if (!core.includes(CORE_MIGRATIONS[0].id)) return bad('This database does not belong to this app.')
    return ok({ migrations: applied.length })
  } catch {
    return bad('This file is not a usable backup of this app.')
  } finally {
    check?.close()
  }
}

export interface RestoreOptions {
  /** Live database file (e.g. userData/data/shop.db). */
  dbPath: string
  /** Where backups and the safety copy go. */
  backupDir: string
  userId: number | null
  userName: string
  /** Closes the live connection (app: closeDb). */
  close: () => void
  /** Opens the restored file, runs migrations and returns the new connection. */
  open: () => Database.Database
}

/**
 * Replaces the live database with the chosen backup. Order matters:
 * validate a private copy -> safety backup of current data -> close -> swap by rename -> reopen + migrate -> audit.
 * Any failure before the swap leaves the current database untouched.
 */
export async function restoreFromFile(
  db: Database.Database, sourcePath: string, opts: RestoreOptions
): Promise<Result<{ safetyBackup: string }>> {
  const incoming = `${opts.dbPath}.restore.tmp`
  let closed = false
  try {
    // Work on a copy next to the live file: a USB stick may vanish or be read-only, and rename needs the same disk.
    copyFileSync(sourcePath, incoming)
  } catch (e) {
    return err({ code: 'RESTORE_FAILED', message: `Could not read the backup file: ${(e as Error).message}` })
  }
  try {
    const valid = validateBackupFile(incoming)
    if (!valid.ok) return valid

    mkdirSync(opts.backupDir, { recursive: true })
    const stamp = `${formatLocalDate().replace(/-/g, '')}-${nowLocal().slice(11).replace(/:/g, '')}`
    let seq = 1
    while (existsSync(join(opts.backupDir, `pre-restore-${stamp}-${seq}.db`))) seq++
    const safetyName = `pre-restore-${stamp}-${seq}.db`
    const safetyTmp = join(opts.backupDir, `${safetyName}.tmp`)
    try {
      await db.backup(safetyTmp)
      verifyFile(safetyTmp)
      fsyncFile(safetyTmp)
      renameSync(safetyTmp, join(opts.backupDir, safetyName))
    } catch (e) {
      safeUnlink(safetyTmp)
      return err({ code: 'RESTORE_FAILED', message: `Could not make a safety backup first, so nothing was changed: ${(e as Error).message}` })
    }

    // Safety copies are not part of the daily rotation; keep only the last few.
    const safety = readdirSync(opts.backupDir).filter((f) => f.startsWith('pre-restore-') && f.endsWith('.db')).sort().reverse()
    for (const f of safety.slice(5)) safeUnlink(join(opts.backupDir, f))

    opts.close()
    closed = true
    // Old -wal/-shm files belong to the old database and must not be applied to the new one.
    safeUnlink(`${opts.dbPath}-wal`)
    safeUnlink(`${opts.dbPath}-shm`)
    renameSync(incoming, opts.dbPath)

    const fresh = opts.open()
    const userExists = opts.userId != null && fresh.prepare('SELECT 1 FROM users WHERE id = ?').get(opts.userId)
    logAudit(fresh, {
      userId: userExists ? opts.userId : null,
      action: 'backup_restored',
      entity: 'database',
      details: { from: sourcePath, safetyBackup: safetyName, by: opts.userName }
    })
    return ok({ safetyBackup: safetyName })
  } catch (e) {
    // After the connection was closed the app cannot continue as it was: the caller must relaunch.
    return err({
      code: closed ? 'RESTORE_FAILED_RELAUNCH' : 'RESTORE_FAILED',
      message: `Restore failed: ${(e as Error).message}`
    })
  } finally {
    safeUnlink(incoming)
    safeUnlink(`${incoming}-wal`)
    safeUnlink(`${incoming}-shm`)
  }
}
