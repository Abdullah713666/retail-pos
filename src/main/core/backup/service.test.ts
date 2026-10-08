import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync, writeFileSync, readdirSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { openDb } from '../../db/connection'
import { runMigrations } from '../../db/migrate'
import { createUser } from '../users/service'
import { createParty } from '../parties/service'
import { createItem } from '../items/service'
import { getSetting } from '../settings/service'
import {
  createBackup, listBackups, restoreFromFile, rotateBackups, runAutoBackup, validateBackupFile
} from './service'

let root: string
let dbPath: string
let db: Database.Database
const opened: Database.Database[] = []

function open(path: string): Database.Database {
  const d = openDb(path)
  runMigrations(d)
  opened.push(d)
  return d
}

function count(d: Database.Database, table: string): number {
  return (d.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
}

function seedRows(d: Database.Database, n: number): void {
  for (let i = 0; i < n; i++) {
    createItem(d, { name: `Item ${Date.now()}-${Math.random()}`, baseUnit: 'pc', salePrice: 100, costPrice: 50, openingStock: { qty: 5 } })
  }
}

const at = (minute: number): Date => new Date(2026, 9, 8, 10, minute, 0)

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pos-backup-'))
  dbPath = join(root, 'shop.db')
  db = open(dbPath)
  createUser(db, { name: 'Owner', username: 'owner', pin: '1234', role: 'owner' })
  createParty(db, { type: 'customer', name: 'Ali' })
  seedRows(db, 3)
})

afterEach(() => {
  for (const d of opened.splice(0)) if (d.open) d.close()
  rmSync(root, { recursive: true, force: true })
})

describe('createBackup', () => {
  it('writes a valid single-file copy with the same row counts and no temp file left', async () => {
    const dir = join(root, 'backups')
    const res = await createBackup(db, { dir, now: at(5) })
    expect(res).toMatchObject({ ok: true, data: { name: 'shop-20261008-1005.db', extraError: null } })
    expect(readdirSync(dir)).toEqual(['shop-20261008-1005.db'])

    const copy = new Database(join(dir, 'shop-20261008-1005.db'), { readonly: true })
    for (const t of ['users', 'parties', 'items', 'stock_movements', 'schema_migrations']) {
      expect(count(copy, t)).toBe(count(db, t))
    }
    expect((copy.pragma('integrity_check') as Array<{ integrity_check: string }>)[0].integrity_check).toBe('ok')
    copy.close()
    expect(validateBackupFile(join(dir, 'shop-20261008-1005.db')).ok).toBe(true)
    expect(getSetting(db, 'last_backup_at')).toMatch(/^\d{4}-\d{2}-\d{2} /)
  })

  it('does not overwrite a backup made in the same minute', async () => {
    const dir = join(root, 'backups')
    await createBackup(db, { dir, now: at(5) })
    const second = await createBackup(db, { dir, now: at(5) })
    expect(second).toMatchObject({ ok: true, data: { name: 'shop-20261008-1005-2.db' } })
    expect(listBackups(dir)).toHaveLength(2)
  })

  it('copies to the extra folder, and a broken extra folder does not fail the backup', async () => {
    const dir = join(root, 'backups')
    const usb = join(root, 'usb')
    const good = await createBackup(db, { dir, extraDir: usb, now: at(1) })
    expect(good.ok && good.data.extraError).toBeNull()
    expect(readdirSync(usb)).toEqual(['shop-20261008-1001.db'])

    const blocker = join(root, 'not-a-folder')
    writeFileSync(blocker, 'x')
    const bad = await createBackup(db, { dir, extraDir: join(blocker, 'sub'), now: at(2) })
    expect(bad.ok).toBe(true)
    expect(bad.ok && bad.data.extraError).toBeTruthy()
    expect(existsSync(join(dir, 'shop-20261008-1002.db'))).toBe(true)
  })

  it('removes leftover .tmp files from an interrupted backup', async () => {
    const dir = join(root, 'backups')
    await createBackup(db, { dir, now: at(1) })
    writeFileSync(join(dir, 'shop-20261008-1002.db.tmp'), 'half written')
    await createBackup(db, { dir, now: at(3) })
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('keeps only the newest N backups in both folders', async () => {
    const dir = join(root, 'backups')
    const usb = join(root, 'usb')
    for (let m = 1; m <= 5; m++) await createBackup(db, { dir, extraDir: usb, keep: 3, now: at(m) })
    const expected = ['shop-20261008-1005.db', 'shop-20261008-1004.db', 'shop-20261008-1003.db']
    expect(listBackups(dir).map((f) => f.name)).toEqual(expected)
    expect(listBackups(usb).map((f) => f.name)).toEqual(expected)
  })

  it('rotation ignores files that are not backups', () => {
    const dir = join(root, 'backups')
    rotateBackups(dir, 1)
    writeFileSync(join(root, 'notes.txt'), 'keep me')
    expect(existsSync(join(root, 'notes.txt'))).toBe(true)
  })
})

describe('runAutoBackup', () => {
  it('startup backs up once per day; close backs up only when data changed', async () => {
    const dir = join(root, 'backups')
    const first = await runAutoBackup(db, 'startup', { dir })
    expect(first.ok && first.data).toBeTruthy()
    const again = await runAutoBackup(db, 'startup', { dir })
    expect(again).toEqual({ ok: true, data: null })

    expect(await runAutoBackup(db, 'close', { dir })).toEqual({ ok: true, data: null })
    seedRows(db, 1)
    const afterChange = await runAutoBackup(db, 'close', { dir, now: new Date(Date.now() + 120_000) })
    expect(afterChange.ok && afterChange.data).toBeTruthy()
    expect(await runAutoBackup(db, 'close', { dir })).toEqual({ ok: true, data: null })
  })
})

describe('validateBackupFile', () => {
  it('rejects a text file, a damaged database, a foreign database and one from a newer app', async () => {
    const text = join(root, 'a.db')
    writeFileSync(text, 'hello, this is not a database')
    expect(validateBackupFile(text)).toMatchObject({ ok: false, error: { code: 'INVALID_BACKUP' } })

    const foreign = join(root, 'foreign.db')
    const f = new Database(foreign)
    f.exec('CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO students (name) VALUES (\'x\')')
    f.close()
    expect(validateBackupFile(foreign)).toMatchObject({ ok: false, error: { code: 'INVALID_BACKUP' } })

    const dir = join(root, 'backups')
    const made = await createBackup(db, { dir, now: at(1) })
    if (!made.ok) throw new Error('backup')
    const good = join(dir, made.data.name)
    const damaged = join(root, 'damaged.db')
    const bytes = readFileSync(good)
    writeFileSync(damaged, bytes.subarray(0, Math.floor(bytes.length / 2)))
    expect(validateBackupFile(damaged).ok).toBe(false)

    const newer = join(root, 'newer.db')
    writeFileSync(newer, bytes)
    const n = new Database(newer)
    n.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES ('099_future', 'now')").run()
    n.close()
    const res = validateBackupFile(newer)
    expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_BACKUP' } })
    expect(!res.ok && res.error.message).toMatch(/newer version/)
  })
})

describe('restoreFromFile', () => {
  function opts(extra: Partial<Parameters<typeof restoreFromFile>[2]> = {}) {
    let closes = 0
    return {
      o: {
        dbPath, backupDir: join(root, 'backups'), userId: 1, userName: 'Owner',
        close: () => { closes++; db.close() },
        open: () => { db = open(dbPath); return db },
        ...extra
      },
      closes: () => closes
    }
  }

  it('restores the chosen backup, keeps a safety copy of the current data and audits', async () => {
    const dir = join(root, 'backups')
    const made = await createBackup(db, { dir, now: at(1) })
    if (!made.ok) throw new Error('backup')
    const itemsAtBackup = count(db, 'items')
    seedRows(db, 4) // work done after the backup, to be rolled back
    const itemsNow = count(db, 'items')
    expect(itemsNow).toBe(itemsAtBackup + 4)

    const { o } = opts()
    const res = await restoreFromFile(db, join(dir, made.data.name), o)
    expect(res.ok).toBe(true)
    expect(count(db, 'items')).toBe(itemsAtBackup)
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal')

    const safety = readdirSync(dir).filter((f) => f.startsWith('pre-restore-'))
    expect(safety).toHaveLength(1)
    const copy = new Database(join(dir, safety[0]), { readonly: true })
    expect(count(copy, 'items')).toBe(itemsNow)
    copy.close()

    const audit = db.prepare("SELECT user_id, details FROM audit_log WHERE action = 'backup_restored'").get() as { user_id: number; details: string }
    expect(audit.user_id).toBe(1)
    expect(JSON.parse(audit.details).safetyBackup).toBe(safety[0])
    expect(readdirSync(root).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('refuses a non-database and a foreign database and leaves the live database untouched', async () => {
    const before = count(db, 'items')
    const text = join(root, 'junk.db')
    writeFileSync(text, 'not sqlite at all')
    const foreign = join(root, 'foreign.db')
    const f = new Database(foreign)
    f.exec('CREATE TABLE other (id INTEGER)')
    f.close()

    for (const file of [text, foreign]) {
      const { o, closes } = opts()
      const res = await restoreFromFile(db, file, o)
      expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_BACKUP' } })
      expect(closes()).toBe(0)
    }
    expect(db.open).toBe(true)
    expect(count(db, 'items')).toBe(before)
    expect(existsSync(join(root, 'backups'))).toBe(false) // no safety copy needed: nothing was changed
    expect(readdirSync(root).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('does not touch anything when the safety backup cannot be made', async () => {
    const dir = join(root, 'backups')
    const made = await createBackup(db, { dir, now: at(1) })
    if (!made.ok) throw new Error('backup')
    const blocker = join(root, 'blocker')
    writeFileSync(blocker, 'x')
    const { o, closes } = opts({ backupDir: join(blocker, 'sub') })
    const res = await restoreFromFile(db, join(dir, made.data.name), o)
    expect(res).toMatchObject({ ok: false, error: { code: 'RESTORE_FAILED' } })
    expect(closes()).toBe(0)
    expect(db.open).toBe(true)
  })

  it('keeps only the last 5 safety copies', async () => {
    const dir = join(root, 'backups')
    const made = await createBackup(db, { dir, now: at(1) })
    if (!made.ok) throw new Error('backup')
    for (let i = 0; i < 7; i++) {
      const { o } = opts()
      expect((await restoreFromFile(db, join(dir, made.data.name), o)).ok).toBe(true)
    }
    expect(readdirSync(dir).filter((f) => f.startsWith('pre-restore-'))).toHaveLength(5)
  })
})
