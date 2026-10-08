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

export function login(db: Database.Database, input: LoginInput): Result<User> {
  const now = Date.now()
  const attempt = failedAttempts.get(input.userId)

  if (attempt && attempt.lockedUntil > now) {
    return err({
      code: 'LOCKED',
      message: 'Too many wrong PINs. Try again in 1 minute.'
    })
  }

  // Lockout expired, reset attempts
  if (attempt && attempt.lockedUntil > 0 && attempt.lockedUntil <= now) {
    failedAttempts.delete(input.userId)
  }

  const verifiedUser = verifyUserPin(db, input.userId, input.pin)
  if (!verifiedUser) {
    const current = failedAttempts.get(input.userId) || { count: 0, lockedUntil: 0 }
    const newCount = current.count + 1

    if (newCount >= 5) {
      failedAttempts.set(input.userId, {
        count: newCount,
        lockedUntil: now + 60000
      })
      return err({
        code: 'LOCKED',
        message: 'Too many wrong PINs. Try again in 1 minute.'
      })
    }

    failedAttempts.set(input.userId, {
      count: newCount,
      lockedUntil: 0
    })
    return err({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid user or PIN'
    })
  }

  // Reset counter on successful login
  failedAttempts.delete(input.userId)
  currentSessionUser = verifiedUser
  return ok(verifiedUser)
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
