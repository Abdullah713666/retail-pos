import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import { createUser } from '../users/service'
import {
  login,
  logout,
  getCurrentUser,
  setCurrentUserForTest,
  checkPermission,
  resetFailedAttemptsForTest
} from './service'

describe('Auth service', () => {
  beforeEach(() => {
    setCurrentUserForTest(null)
    resetFailedAttemptsForTest()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('authenticates user and manages session', () => {
    const db = createTestDb()
    const user = createUser(db, {
      name: 'Owner',
      username: 'owner',
      pin: '1234',
      role: 'owner'
    })

    const failRes = login(db, { userId: user.id, pin: '0000' })
    expect(failRes.ok).toBe(false)
    expect(getCurrentUser()).toBeNull()

    const okRes = login(db, { userId: user.id, pin: '1234' })
    expect(okRes.ok).toBe(true)
    if (okRes.ok) {
      expect(okRes.data.username).toBe('owner')
    }
    expect(getCurrentUser()?.id).toBe(user.id)

    logout()
    expect(getCurrentUser()).toBeNull()
  })

  it('locks out user after 5 wrong PIN attempts for 60 seconds', () => {
    vi.useFakeTimers()
    const db = createTestDb()
    const user = createUser(db, {
      name: 'Cashier',
      username: 'cashier',
      pin: '1234',
      role: 'cashier'
    })

    // First 4 wrong attempts return INVALID_CREDENTIALS
    for (let i = 1; i <= 4; i++) {
      const res = login(db, { userId: user.id, pin: '0000' })
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error.code).toBe('INVALID_CREDENTIALS')
      }
    }

    // 5th wrong attempt triggers lockout
    const fifthRes = login(db, { userId: user.id, pin: '0000' })
    expect(fifthRes.ok).toBe(false)
    if (!fifthRes.ok) {
      expect(fifthRes.error.code).toBe('LOCKED')
      expect(fifthRes.error.message).toBe('Too many wrong PINs. Try again in 1 minute.')
    }

    // Even with correct PIN, login is refused while locked
    const lockedRes = login(db, { userId: user.id, pin: '1234' })
    expect(lockedRes.ok).toBe(false)
    if (!lockedRes.ok) {
      expect(lockedRes.error.code).toBe('LOCKED')
    }

    // Fast-forward 60 seconds
    vi.advanceTimersByTime(60000)

    // Now correct PIN succeeds and unlocks
    const successRes = login(db, { userId: user.id, pin: '1234' })
    expect(successRes.ok).toBe(true)
    expect(getCurrentUser()?.id).toBe(user.id)
  })

  it('resets failed attempt counter on successful login', () => {
    const db = createTestDb()
    const user = createUser(db, {
      name: 'Owner',
      username: 'owner',
      pin: '1234',
      role: 'owner'
    })

    // 4 wrong attempts
    for (let i = 0; i < 4; i++) {
      login(db, { userId: user.id, pin: '9999' })
    }

    // Correct PIN resets counter
    const success = login(db, { userId: user.id, pin: '1234' })
    expect(success.ok).toBe(true)

    logout()

    // 1 more wrong attempt should not trigger lockout
    const nextFail = login(db, { userId: user.id, pin: '9999' })
    expect(nextFail.ok).toBe(false)
    if (!nextFail.ok) {
      expect(nextFail.error.code).toBe('INVALID_CREDENTIALS')
    }
  })

  it('checks permissions strictly without bypass for unauthenticated callers', () => {
    const db = createTestDb()

    // 1. Fresh DB with no users still rejects unauthenticated calls
    const unauthNoUsers = checkPermission(db, ['owner'])
    expect(unauthNoUsers.ok).toBe(false)
    if (!unauthNoUsers.ok) {
      expect(unauthNoUsers.error.code).toBe('UNAUTHORIZED')
    }

    // 2. Unauthenticated caller is rejected when users exist
    const cashier = createUser(db, {
      name: 'Cashier',
      username: 'cashier',
      pin: '1234',
      role: 'cashier'
    })

    const unauth = checkPermission(db, ['owner'])
    expect(unauth.ok).toBe(false)
    if (!unauth.ok) {
      expect(unauth.error.code).toBe('UNAUTHORIZED')
    }

    // 3. Cashier cannot access owner-only action
    login(db, { userId: cashier.id, pin: '1234' })
    const forbidden = checkPermission(db, ['owner'])
    expect(forbidden.ok).toBe(false)
    if (!forbidden.ok) {
      expect(forbidden.error.code).toBe('FORBIDDEN')
    }

    // 4. Cashier CAN access cashier-allowed action
    expect(checkPermission(db, ['cashier', 'owner']).ok).toBe(true)
  })
})
