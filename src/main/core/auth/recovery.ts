import crypto from 'crypto'
import type Database from 'better-sqlite3'
import { ok, err, type Result } from '@shared/result'
import { hashPin, hashSecret, verifySecretHash } from '../users/service'
import { logAudit } from '../audit/service'
import { clearFailedAttempts } from './service'

export const RECOVERY_HASH_KEY = 'owner_recovery_hash'

// No 0/O/1/I lookalikes. 32 symbols, so one random byte & 31 is unbiased.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_WRONG_CODES = 5
const LOCK_MS = 15 * 60 * 1000

const state = { wrong: 0, lockedUntil: 0 }

export function resetRecoveryLockForTest(): void {
  state.wrong = 0
  state.lockedUntil = 0
}

/** Random code like ABCD-EFGH-JKMN (12 symbols, about 60 bits). */
export function generateRecoveryCode(): string {
  const bytes = crypto.randomBytes(12)
  let chars = ''
  for (const b of bytes) {
    chars += ALPHABET[b & 31]
  }
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`
}

function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function readHash(db: Database.Database): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(RECOVERY_HASH_KEY) as
    | { value: string }
    | undefined
  return row && row.value ? row.value : null
}

/**
 * Creates a new code, stores ONLY its hash (replacing any old one) and returns the
 * plain code so the caller can show it once. Runs inside the caller's transaction if any.
 */
export function storeNewRecoveryCode(db: Database.Database): string {
  const code = generateRecoveryCode()
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(RECOVERY_HASH_KEY, hashSecret(normalizeCode(code)))
  return code
}

export function hasRecoveryCode(db: Database.Database): boolean {
  return readHash(db) !== null
}

/**
 * Resets the first active owner's PIN using the recovery code.
 * 5 wrong codes lock this for 15 minutes (in memory). The code works once.
 */
export function recoverOwnerPin(
  db: Database.Database,
  input: { code: string; newPin: string }
): Result<void> {
  const now = Date.now()
  if (state.lockedUntil > now) {
    logAudit(db, { action: 'recovery.locked', entity: 'user' })
    return err({ code: 'LOCKED', message: 'Too many wrong codes. Try again in 15 minutes.' })
  }
  if (state.lockedUntil > 0) {
    state.wrong = 0
    state.lockedUntil = 0
  }

  if (!/^\d{4,6}$/.test(input.newPin)) {
    return err({ code: 'INVALID_PIN', message: 'PIN must be between 4 and 6 digits' })
  }

  const stored = readHash(db)
  if (!stored) {
    logAudit(db, { action: 'recovery.failed', entity: 'user', details: { reason: 'no_code' } })
    return err({ code: 'NO_RECOVERY_CODE', message: 'No recovery code is set for this shop.' })
  }

  if (!verifySecretHash(normalizeCode(input.code), stored)) {
    state.wrong += 1
    const locked = state.wrong >= MAX_WRONG_CODES
    if (locked) state.lockedUntil = now + LOCK_MS
    logAudit(db, {
      action: locked ? 'recovery.locked' : 'recovery.failed',
      entity: 'user',
      details: { reason: 'wrong_code', attempts: state.wrong }
    })
    return err(
      locked
        ? { code: 'LOCKED', message: 'Too many wrong codes. Try again in 15 minutes.' }
        : { code: 'INVALID_CODE', message: 'Wrong recovery code' }
    )
  }

  const owner = db
    .prepare("SELECT id FROM users WHERE role = 'owner' AND active = 1 ORDER BY id LIMIT 1")
    .get() as { id: number } | undefined
  if (!owner) {
    return err({ code: 'NOT_FOUND', message: 'No active owner found' })
  }

  db.transaction(() => {
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(input.newPin), owner.id)
    db.prepare('DELETE FROM settings WHERE key = ?').run(RECOVERY_HASH_KEY)
    logAudit(db, { userId: owner.id, action: 'recovery.success', entity: 'user', entityId: owner.id })
  })()

  state.wrong = 0
  state.lockedUntil = 0
  clearFailedAttempts(owner.id)
  return ok(undefined)
}
