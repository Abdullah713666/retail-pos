import type Database from 'better-sqlite3'
import type { Approval, Role } from '@shared/types'
import { abort } from '../../db/tx'
import { verifyUserPin } from '../users/service'

const MAX_TRIES = 5
const LOCK_MS = 60_000
const failures = new Map<number, { count: number; lockedUntil: number }>()

export function resetApprovalLocksForTest(): void {
  failures.clear()
}

/**
 * Checks a manager/owner PIN typed on the sale screen (void, cashier return).
 * Returns the approver's user id. Wrong PINs lock that approver for a minute after 5 tries,
 * so a cashier cannot guess a 4-digit PIN. Throws TxAbort on failure (call inside runAtomic).
 */
export function requireApproval(
  db: Database.Database,
  approval: Approval | null | undefined,
  allowed: Role[] = ['manager', 'owner']
): number {
  if (!approval) abort('APPROVAL_REQUIRED', 'A manager or owner PIN is needed for this')
  const now = Date.now()
  const f = failures.get(approval.userId)
  if (f && f.lockedUntil > now) abort('LOCKED', 'Too many wrong PINs. Try again in 1 minute.')

  const user = verifyUserPin(db, approval.userId, approval.pin)
  if (!user || !allowed.includes(user.role)) {
    const count = (f && f.lockedUntil <= now && f.lockedUntil > 0 ? 0 : (f?.count ?? 0)) + 1
    failures.set(approval.userId, { count, lockedUntil: count >= MAX_TRIES ? now + LOCK_MS : 0 })
    abort('INVALID_APPROVAL', allowed.length === 1 ? 'Wrong owner PIN' : 'Wrong manager PIN')
  }
  failures.delete(approval.userId)
  return user.id
}
