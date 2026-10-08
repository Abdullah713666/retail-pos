import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import { createUser } from '../users/service'
import { setCurrentUserForTest, checkPermission } from '../auth/service'
import { partyRoles, canSetPartyMoney } from './permissions'
import type { Role } from '@shared/types'

describe('Party permissions', () => {
  beforeEach(() => setCurrentUserForTest(null))

  it('lets cashiers work with customers and take payments, but not deactivate', () => {
    expect(partyRoles('customer', 'read')).toContain('cashier')
    expect(partyRoles('customer', 'write')).toContain('cashier')
    expect(partyRoles('customer', 'payment')).toContain('cashier')
    expect(partyRoles('customer', 'deactivate')).not.toContain('cashier')
  })

  it('keeps suppliers away from cashiers for every action', () => {
    for (const action of ['read', 'write', 'payment', 'deactivate'] as const) {
      expect(partyRoles('supplier', action)).toEqual(['manager', 'owner'])
    }
  })

  it('only managers and owners may set credit limit / opening balance', () => {
    const roles: Role[] = ['cashier', 'manager', 'owner']
    expect(roles.map(canSetPartyMoney)).toEqual([false, true, true])
  })

  it('is enforced through the session user', () => {
    const db = createTestDb()
    const cashier = createUser(db, { name: 'C', username: 'c', pin: '1234', role: 'cashier' })
    // not logged in
    expect(checkPermission(partyRoles('customer', 'read'))).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } })
    setCurrentUserForTest(cashier)
    expect(checkPermission(partyRoles('customer', 'payment')).ok).toBe(true)
    expect(checkPermission(partyRoles('supplier', 'payment'))).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    expect(checkPermission(partyRoles('customer', 'deactivate'))).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })
})
