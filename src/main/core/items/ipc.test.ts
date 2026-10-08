import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import { createUser } from '../users/service'
import { setCurrentUserForTest, checkPermission } from '../auth/service'
import { createItem, listCategories, searchItems } from './service'

describe('Items permissions and access control', () => {
  beforeEach(() => {
    setCurrentUserForTest(null)
  })

  it('allows cashiers to search and read items but denies item modifications', () => {
    const db = createTestDb()
    const cashier = createUser(db, {
      name: 'Cashier 1',
      username: 'cashier1',
      pin: '1234',
      role: 'cashier'
    })
    const owner = createUser(db, {
      name: 'Owner',
      username: 'owner',
      pin: '1234',
      role: 'owner'
    })

    // Setup an item as owner
    setCurrentUserForTest(owner)
    const itemRes = createItem(db, {
      name: 'Panadol 500mg',
      baseUnit: 'tablet',
      salePrice: 350,
      costPrice: 280
    })
    expect(itemRes.ok).toBe(true)

    // Switch session to cashier
    setCurrentUserForTest(cashier)

    // Cashier can read/search
    const readPerm = checkPermission(['cashier', 'manager', 'owner'])
    expect(readPerm.ok).toBe(true)
    expect(searchItems(db, 'Panadol')).toHaveLength(1)
    expect(listCategories(db)).toBeDefined()

    // Cashier cannot mutate items
    const mutatePerm = checkPermission(['manager', 'owner'])
    expect(mutatePerm.ok).toBe(false)
    if (!mutatePerm.ok) {
      expect(mutatePerm.error.code).toBe('FORBIDDEN')
    }
  })

  it('allows managers to mutate items and categories', () => {
    const db = createTestDb()
    const manager = createUser(db, {
      name: 'Manager 1',
      username: 'manager1',
      pin: '1234',
      role: 'manager'
    })

    setCurrentUserForTest(manager)
    const mutatePerm = checkPermission(['manager', 'owner'])
    expect(mutatePerm.ok).toBe(true)

    const created = createItem(db, {
      name: 'Brufen 400mg',
      baseUnit: 'tablet',
      salePrice: 500,
      costPrice: 400
    }, manager.id)
    expect(created.ok).toBe(true)
  })
})
