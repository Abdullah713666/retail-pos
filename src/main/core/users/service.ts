import crypto from 'crypto'
import type Database from 'better-sqlite3'
import { nowLocal } from '@shared/dates'
import type { Role, User, CreateUserInput } from '@shared/types'

export interface UserRow {
  id: number
  name: string
  username: string
  pin_hash: string
  role: Role
  active: number
  created_at: string
}

/**
 * Hashes a PIN using Node's crypto.scrypt with a random salt.
 */
export function hashPin(pin: string): string {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('PIN must be between 4 and 6 digits')
  }
  return hashSecret(pin)
}

/**
 * scrypt + random salt for any secret string (PINs, recovery codes). Format: salt:hash.
 */
export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(secret, salt, 64)
  return `${salt}:${derivedKey.toString('hex')}`
}

/**
 * Verifies a PIN against a stored salt:hash string using timingSafeEqual.
 */
export function verifyPinHash(pin: string, storedHash: string): boolean {
  return verifySecretHash(pin, storedHash)
}

export function verifySecretHash(secret: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) {
    return false
  }
  const [salt, keyHex] = storedHash.split(':')
  const storedBuffer = Buffer.from(keyHex, 'hex')
  const derivedBuffer = crypto.scryptSync(secret, salt, 64)
  if (storedBuffer.length !== derivedBuffer.length) {
    return false
  }
  return crypto.timingSafeEqual(storedBuffer, derivedBuffer)
}

function toSafeUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    active: row.active,
    createdAt: row.created_at
  }
}

/**
 * Creates a new user with hashed PIN.
 */
export function createUser(db: Database.Database, input: CreateUserInput): User {
  const trimmedName = input.name.trim()
  const trimmedUsername = input.username.trim().toLowerCase()

  if (!trimmedName) {
    throw new Error('Name cannot be empty')
  }
  if (!trimmedUsername) {
    throw new Error('Username cannot be empty')
  }
  if (!['owner', 'manager', 'cashier'].includes(input.role)) {
    throw new Error(`Invalid role: ${input.role}`)
  }

  const pinHash = hashPin(input.pin)
  const createdAt = nowLocal()

  const info = db
    .prepare(`
      INSERT INTO users (name, username, pin_hash, role, active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `)
    .run(trimmedName, trimmedUsername, pinHash, input.role, createdAt)

  return {
    id: Number(info.lastInsertRowid),
    name: trimmedName,
    username: trimmedUsername,
    role: input.role,
    active: 1,
    createdAt
  }
}

/**
 * Returns all active users (or including inactive if requested).
 */
export function listUsers(
  db: Database.Database,
  options: { includeInactive?: boolean } = {}
): User[] {
  const query = options.includeInactive
    ? 'SELECT * FROM users ORDER BY name ASC'
    : 'SELECT * FROM users WHERE active = 1 ORDER BY name ASC'

  const rows = db.prepare(query).all() as UserRow[]
  return rows.map(toSafeUser)
}

/**
 * Finds user by ID.
 */
export function getUserById(db: Database.Database, id: number): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  return row ? toSafeUser(row) : null
}

/**
 * Checks if any user exists in the database.
 */
export function hasUsers(db: Database.Database): boolean {
  const countRow = db.prepare('SELECT count(*) as count FROM users WHERE active = 1').get() as {
    count: number
  }
  return countRow.count > 0
}

/**
 * Deactivates a user. Prevents deactivating the last active owner.
 */
export function deactivateUser(db: Database.Database, userId: number): void {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined
  if (!user) {
    throw new Error('User not found')
  }

  if (user.role === 'owner') {
    const ownerCountRow = db
      .prepare("SELECT count(*) as count FROM users WHERE role = 'owner' AND active = 1")
      .get() as { count: number }
    if (ownerCountRow.count <= 1) {
      throw new Error('Cannot deactivate the only active owner')
    }
  }

  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(userId)
}

/**
 * Verifies user credentials and returns safe user if PIN matches.
 */
export function verifyUserPin(
  db: Database.Database,
  userId: number,
  pin: string
): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(userId) as
    | UserRow
    | undefined

  if (!row) {
    return null
  }

  if (!verifyPinHash(pin, row.pin_hash)) {
    return null
  }

  return toSafeUser(row)
}
