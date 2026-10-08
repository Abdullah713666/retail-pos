import type Database from 'better-sqlite3'
import { ok, err, type Result } from '@shared/result'
import type { Role, User, LoginInput } from '@shared/types'
import { verifyUserPin } from '../users/service'

let currentSessionUser: User | null = null

interface FailedAttemptInfo {
  count: number
  lockedUntil: number
}

const failedAttempts = new Map<number, FailedAttemptInfo>()

export function resetFailedAttemptsForTest(): void {
  failedAttempts.clear()
}

export function getCurrentUser(): User | null {
  return currentSessionUser
}

export function setCurrentUserForTest(user: User | null): void {
  currentSessionUser = user
}

/**
 * Checks a PIN with the shared 5-strikes / 1-minute lockout. Used by login and by
 * every "enter your current PIN" step, so guessing there is limited too.
 */
export function checkPinWithLockout(
  db: Database.Database,
  userId: number,
  pin: string
): Result<User> {
  const now = Date.now()
  const attempt = failedAttempts.get(userId)

  if (attempt && attempt.lockedUntil > now) {
    return err({
      code: 'LOCKED',
      message: 'Too many wrong PINs. Try again in 1 minute.'
    })
  }

  // Lockout expired, reset attempts
  if (attempt && attempt.lockedUntil > 0 && attempt.lockedUntil <= now) {
    failedAttempts.delete(userId)
  }

  const verifiedUser = verifyUserPin(db, userId, pin)
  if (!verifiedUser) {
    const current = failedAttempts.get(userId) || { count: 0, lockedUntil: 0 }
    const newCount = current.count + 1

    if (newCount >= 5) {
      failedAttempts.set(userId, {
        count: newCount,
        lockedUntil: now + 60000
      })
      return err({
        code: 'LOCKED',
        message: 'Too many wrong PINs. Try again in 1 minute.'
      })
    }

    failedAttempts.set(userId, {
      count: newCount,
      lockedUntil: 0
    })
    return err({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid user or PIN'
    })
  }

  // Reset counter on success
  failedAttempts.delete(userId)
  return ok(verifiedUser)
}

/** Clears a user's wrong-PIN counter (after an owner reset or recovery). */
export function clearFailedAttempts(userId: number): void {
  failedAttempts.delete(userId)
}

export function login(db: Database.Database, input: LoginInput): Result<User> {
  const res = checkPinWithLockout(db, input.userId, input.pin)
  if (res.ok) {
    currentSessionUser = res.data
  }
  return res
}

export function logout(): Result<void> {
  currentSessionUser = null
  return ok(undefined)
}

/**
 * Checks whether the current user has permission for the given roles.
 * Rejects unauthenticated or unauthorized users.
 */
export function checkPermission(
  dbOrRoles: Database.Database | Role[],
  maybeRoles?: Role[]
): Result<void> {
  const allowedRoles = Array.isArray(dbOrRoles) ? dbOrRoles : (maybeRoles || [])

  if (!currentSessionUser) {
    return err({
      code: 'UNAUTHORIZED',
      message: 'User must be logged in'
    })
  }

  if (!allowedRoles.includes(currentSessionUser.role)) {
    return err({
      code: 'FORBIDDEN',
      message: `Permission denied. Required role: ${allowedRoles.join(' or ')}`
    })
  }

  return ok(undefined)
}
