import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import {
  hashPin,
  verifyPinHash,
  createUser,
  listUsers,
  getUserById,
  hasUsers,
  deactivateUser,
  verifyUserPin
} from './service'

describe('Users service', () => {
  describe('PIN hashing & verification', () => {
    it('hashes and verifies valid 4-6 digit PINs', () => {
      const pin = '1234'
      const hashed = hashPin(pin)
      expect(hashed).toContain(':')
      expect(verifyPinHash(pin, hashed)).toBe(true)
      expect(verifyPinHash('0000', hashed)).toBe(false)
      expect(verifyPinHash('12345', hashed)).toBe(false)
    })

    it('rejects invalid PIN formats', () => {
      expect(() => hashPin('')).toThrow('PIN must be between 4 and 6 digits')
      expect(() => hashPin('123')).toThrow('PIN must be between 4 and 6 digits')
      expect(() => hashPin('1234567')).toThrow('PIN must be between 4 and 6 digits')
      expect(() => hashPin('abcd')).toThrow('PIN must be between 4 and 6 digits')
    })
  })

  describe('User CRUD & permissions', () => {
    it('initially hasUsers returns false', () => {
      const db = createTestDb()
      expect(hasUsers(db)).toBe(false)
    })

    it('creates a user and returns safe representation without pin_hash', () => {
      const db = createTestDb()
      const user = createUser(db, {
        name: 'Abdullah',
        username: 'owner',
        pin: '1234',
        role: 'owner'
      })

      expect(user.id).toBeGreaterThan(0)
      expect(user.name).toBe('Abdullah')
      expect(user.username).toBe('owner')
      expect(user.role).toBe('owner')
      expect(user.active).toBe(1)
      expect(user.createdAt).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((user as any).pin_hash).toBeUndefined()

      expect(hasUsers(db)).toBe(true)
    })

    it('prevents duplicate usernames', () => {
      const db = createTestDb()
      createUser(db, {
        name: 'Owner 1',
        username: 'owner',
        pin: '1111',
        role: 'owner'
      })

      expect(() =>
        createUser(db, {
          name: 'Owner 2',
          username: 'owner',
          pin: '2222',
          role: 'owner'
        })
      ).toThrow()
    })

    it('lists users and gets user by id', () => {
      const db = createTestDb()
      createUser(db, { name: 'Owner', username: 'owner', pin: '1111', role: 'owner' })
      createUser(db, { name: 'Cashier', username: 'cashier', pin: '2222', role: 'cashier' })

      const users = listUsers(db)
      expect(users.length).toBe(2)
      expect(users[0].name).toBeDefined()

      const retrieved = getUserById(db, users[0].id)
      expect(retrieved?.username).toBe(users[0].username)
    })

    it('verifies PIN against active user', () => {
      const db = createTestDb()
      const created = createUser(db, {
        name: 'Manager',
        username: 'mgr',
        pin: '5678',
        role: 'manager'
      })

      const success = verifyUserPin(db, created.id, '5678')
      expect(success).not.toBeNull()
      expect(success?.username).toBe('mgr')

      const failed = verifyUserPin(db, created.id, '9999')
      expect(failed).toBeNull()
    })

    it('protects against deactivating the last active owner', () => {
      const db = createTestDb()
      const owner = createUser(db, {
        name: 'Only Owner',
        username: 'owner',
        pin: '1234',
        role: 'owner'
      })

      expect(() => deactivateUser(db, owner.id)).toThrow('Cannot deactivate the only active owner')

      // Adding a second owner allows deactivating the first
      createUser(db, {
        name: 'Second Owner',
        username: 'owner2',
        pin: '1234',
        role: 'owner'
      })

      expect(() => deactivateUser(db, owner.id)).not.toThrow()
      expect(getUserById(db, owner.id)?.active).toBe(0)

      // Deactivated user cannot authenticate
      expect(verifyUserPin(db, owner.id, '1234')).toBeNull()
    })
  })
})
