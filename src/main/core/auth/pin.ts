import type Database from 'better-sqlite3'
import { ok, err, type Result } from '@shared/result'
import { hashPin } from '../users/service'
import { logAudit } from '../audit/service'
import {
  checkPermission,
  checkPinWithLockout,
  clearFailedAttempts,
  getCurrentUser
} from './service'
import { storeNewRecoveryCode } from './recovery'

function validPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin)
}

const BAD_PIN = { code: 'INVALID_PIN', message: 'PIN must be between 4 and 6 digits' }

/** Any logged-in user changes their own PIN. A wrong current PIN counts toward the lockout. */
export function changeOwnPin(
  db: Database.Database,
  input: { currentPin: string; newPin: string }
): Result<void> {
  const me = getCurrentUser()
  if (!me) return err({ code: 'UNAUTHORIZED', message: 'User must be logged in' })
  if (!validPin(input.newPin)) return err(BAD_PIN)

  const check = checkPinWithLockout(db, me.id, input.currentPin)
  if (!check.ok) {
    return err({
      code: check.error.code === 'LOCKED' ? 'LOCKED' : 'WRONG_CURRENT_PIN',
      message: check.error.code === 'LOCKED' ? check.error.message : 'Current PIN is wrong'
    })
  }

  db.transaction(() => {
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(input.newPin), me.id)
    logAudit(db, { userId: me.id, action: 'user.pin_change', entity: 'user', entityId: me.id })
  })()
  return ok(undefined)
}

/** Owner sets a new PIN for ANOTHER user. Own PIN needs the current PIN (changeOwnPin). */
export function resetUserPin(
  db: Database.Database,
  input: { userId: number; newPin: string }
): Result<void> {
  const perm = checkPermission(db, ['owner'])
  if (!perm.ok) return perm
  const me = getCurrentUser()!
  if (!validPin(input.newPin)) return err(BAD_PIN)
  if (input.userId === me.id) {
    return err({ code: 'USE_CHANGE_PIN', message: 'Use "Change my PIN" for your own PIN' })
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ? AND active = 1').get(input.userId)
  if (!target) return err({ code: 'NOT_FOUND', message: 'User not found' })

  db.transaction(() => {
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(
      hashPin(input.newPin),
      input.userId
    )
    logAudit(db, {
      userId: me.id,
      action: 'user.pin_reset',
      entity: 'user',
      entityId: input.userId
    })
  })()
  clearFailedAttempts(input.userId)
  return ok(undefined)
}

/** Owner replaces the recovery code. Needs the owner's current PIN. Returns the code ONCE. */
export function regenerateRecoveryCode(
  db: Database.Database,
  input: { pin: string }
): Result<{ code: string }> {
  const perm = checkPermission(db, ['owner'])
  if (!perm.ok) return perm
  const me = getCurrentUser()!

  const check = checkPinWithLockout(db, me.id, input.pin)
  if (!check.ok) {
    return err({
      code: check.error.code === 'LOCKED' ? 'LOCKED' : 'WRONG_CURRENT_PIN',
      message: check.error.code === 'LOCKED' ? check.error.message : 'Current PIN is wrong'
    })
  }

  const code = db.transaction(() => {
    const c = storeNewRecoveryCode(db)
    logAudit(db, { userId: me.id, action: 'recovery.regenerate', entity: 'user', entityId: me.id })
    return c
  })()
  return ok({ code })
}
