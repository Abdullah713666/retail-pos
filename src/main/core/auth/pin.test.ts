import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// completeSetup initialises modules, which touches Electron's ipcMain.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))
import { createTestDb } from '../../db/test-helper'
import { createUser, verifyUserPin } from '../users/service'
import { completeSetup, getAllSettings } from '../settings/service'
import {
  login,
  logout,
  setCurrentUserForTest,
  resetFailedAttemptsForTest
} from './service'
import { changeOwnPin, resetUserPin, regenerateRecoveryCode } from './pin'
import {
  recoverOwnerPin,
  hasRecoveryCode,
  resetRecoveryLockForTest,
  RECOVERY_HASH_KEY
} from './recovery'

function setup() {
  const db = createTestDb()
  const owner = createUser(db, { name: 'Owner', username: 'owner', pin: '1234', role: 'owner' })
  const cashier = createUser(db, { name: 'C', username: 'cash', pin: '1111', role: 'cashier' })
  return { db, owner, cashier }
}

const auditActions = (db: ReturnType<typeof createTestDb>): string[] =>
  (db.prepare('SELECT action FROM audit_log ORDER BY id').all() as { action: string }[]).map(
    (r) => r.action
  )

describe('PIN change, reset and recovery', () => {
  beforeEach(() => {
    setCurrentUserForTest(null)
    resetFailedAttemptsForTest()
    resetRecoveryLockForTest()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('changeOwnPin', () => {
    it('changes the PIN when the current PIN is right', () => {
      const { db, cashier } = setup()
      login(db, { userId: cashier.id, pin: '1111' })
      const res = changeOwnPin(db, { currentPin: '1111', newPin: '2222' })
      expect(res.ok).toBe(true)
      expect(verifyUserPin(db, cashier.id, '2222')).not.toBeNull()
      expect(verifyUserPin(db, cashier.id, '1111')).toBeNull()
      expect(auditActions(db)).toContain('user.pin_change')
    })

    it('rejects a wrong current PIN and counts it toward the lockout', () => {
      const { db, cashier } = setup()
      login(db, { userId: cashier.id, pin: '1111' })
      for (let i = 0; i < 4; i++) {
        const r = changeOwnPin(db, { currentPin: '0000', newPin: '2222' })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.error.code).toBe('WRONG_CURRENT_PIN')
      }
      const fifth = changeOwnPin(db, { currentPin: '0000', newPin: '2222' })
      expect(fifth.ok).toBe(false)
      if (!fifth.ok) expect(fifth.error.code).toBe('LOCKED')
      // Even the right PIN is refused while locked
      expect(changeOwnPin(db, { currentPin: '1111', newPin: '2222' }).ok).toBe(false)
      expect(verifyUserPin(db, cashier.id, '1111')).not.toBeNull()
    })

    it('requires login and a valid new PIN', () => {
      const { db, cashier } = setup()
      expect(changeOwnPin(db, { currentPin: '1111', newPin: '2222' }).ok).toBe(false)
      login(db, { userId: cashier.id, pin: '1111' })
      expect(changeOwnPin(db, { currentPin: '1111', newPin: 'abc' }).ok).toBe(false)
    })
  })

  describe('resetUserPin', () => {
    it('lets the owner reset another user and logs it', () => {
      const { db, owner, cashier } = setup()
      login(db, { userId: owner.id, pin: '1234' })
      const res = resetUserPin(db, { userId: cashier.id, newPin: '9999' })
      expect(res.ok).toBe(true)
      expect(verifyUserPin(db, cashier.id, '9999')).not.toBeNull()
      expect(auditActions(db)).toContain('user.pin_reset')
    })

    it('does not let the owner reset their own PIN this way', () => {
      const { db, owner } = setup()
      login(db, { userId: owner.id, pin: '1234' })
      const res = resetUserPin(db, { userId: owner.id, newPin: '9999' })
      expect(res.ok).toBe(false)
      expect(verifyUserPin(db, owner.id, '1234')).not.toBeNull()
    })

    it('rejects non-owners and logged-out callers', () => {
      const { db, owner, cashier } = setup()
      expect(resetUserPin(db, { userId: cashier.id, newPin: '9999' }).ok).toBe(false)
      login(db, { userId: cashier.id, pin: '1111' })
      const res = resetUserPin(db, { userId: owner.id, newPin: '9999' })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.code).toBe('FORBIDDEN')
      expect(verifyUserPin(db, owner.id, '1234')).not.toBeNull()
    })
  })

  describe('recovery code', () => {
    function setupWithCode() {
      const db = createTestDb()
      const res = completeSetup(db, {
        shop: { name: 'Shop' },
        moduleIds: [],
        owner: { name: 'Owner', username: 'owner', pin: '1234' }
      })
      if (!res.ok) throw new Error(res.error.message)
      logout()
      return { db, owner: res.data.user, code: res.data.recoveryCode }
    }

    it('setup returns a formatted code and stores only its hash', () => {
      const { db, code } = setupWithCode()
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
      const stored = getAllSettings(db)[RECOVERY_HASH_KEY]
      expect(stored).toBeTruthy()
      expect(stored).not.toContain(code)
      expect(stored).not.toContain(code.replace(/-/g, ''))
      expect(stored).toMatch(/^[0-9a-f]+:[0-9a-f]+$/)
    })

    it('resets the owner PIN once, then the code is consumed', () => {
      const { db, owner, code } = setupWithCode()
      const res = recoverOwnerPin(db, { code: code.toLowerCase(), newPin: '5555' })
      expect(res.ok).toBe(true)
      expect(verifyUserPin(db, owner.id, '5555')).not.toBeNull()
      expect(verifyUserPin(db, owner.id, '1234')).toBeNull()
      expect(hasRecoveryCode(db)).toBe(false)
      expect(auditActions(db)).toContain('recovery.success')

      const again = recoverOwnerPin(db, { code, newPin: '6666' })
      expect(again.ok).toBe(false)
      expect(verifyUserPin(db, owner.id, '5555')).not.toBeNull()
    })

    it('locks for 15 minutes after 5 wrong codes', () => {
      vi.useFakeTimers()
      const { db, owner, code } = setupWithCode()
      for (let i = 0; i < 4; i++) {
        const r = recoverOwnerPin(db, { code: 'AAAA-BBBB-CCCC', newPin: '5555' })
        if (!r.ok) expect(r.error.code).toBe('INVALID_CODE')
      }
      const fifth = recoverOwnerPin(db, { code: 'AAAA-BBBB-CCCC', newPin: '5555' })
      expect(fifth.ok).toBe(false)
      if (!fifth.ok) expect(fifth.error.code).toBe('LOCKED')

      // Right code is refused while locked
      const locked = recoverOwnerPin(db, { code, newPin: '5555' })
      expect(locked.ok).toBe(false)
      expect(verifyUserPin(db, owner.id, '1234')).not.toBeNull()

      vi.advanceTimersByTime(15 * 60 * 1000 + 1)
      expect(recoverOwnerPin(db, { code, newPin: '5555' }).ok).toBe(true)
      expect(auditActions(db)).toContain('recovery.failed')
      expect(auditActions(db)).toContain('recovery.locked')
    })

    it('never writes the code into the audit log', () => {
      const { db, code } = setupWithCode()
      recoverOwnerPin(db, { code: 'WRONG-CODE-1234', newPin: '5555' })
      recoverOwnerPin(db, { code, newPin: '5555' })
      const dump = JSON.stringify(db.prepare('SELECT * FROM audit_log').all())
      expect(dump).not.toContain(code)
      expect(dump).not.toContain('WRONG')
    })

    it('regenerate needs the owner PIN and replaces the old code', () => {
      const { db, owner, code } = setupWithCode()
      // Not logged in
      expect(regenerateRecoveryCode(db, { pin: '1234' }).ok).toBe(false)

      login(db, { userId: owner.id, pin: '1234' })
      const wrong = regenerateRecoveryCode(db, { pin: '0000' })
      expect(wrong.ok).toBe(false)
      if (!wrong.ok) expect(wrong.error.code).toBe('WRONG_CURRENT_PIN')

      const res = regenerateRecoveryCode(db, { pin: '1234' })
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.data.code).not.toBe(code)
      logout()
      expect(recoverOwnerPin(db, { code, newPin: '5555' }).ok).toBe(false)
      expect(recoverOwnerPin(db, { code: res.data.code, newPin: '5555' }).ok).toBe(true)
    })

    it('non-owners cannot regenerate', () => {
      const { db, cashier } = setup()
      login(db, { userId: cashier.id, pin: '1111' })
      const res = regenerateRecoveryCode(db, { pin: '1111' })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.code).toBe('FORBIDDEN')
    })
  })
})
