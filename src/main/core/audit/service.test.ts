import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import { logAudit } from './service'

describe('Audit service', () => {
  it('records audit log entries', () => {
    const db = createTestDb()

    logAudit(db, {
      userId: null,
      action: 'test_action',
      entity: 'items',
      entityId: 42,
      details: { foo: 'bar' }
    })

    const row = db
      .prepare('SELECT * FROM audit_log WHERE entity = ? AND entity_id = ?')
      .get('items', 42) as { action: string; details: string }

    expect(row).toBeDefined()
    expect(row.action).toBe('test_action')
    expect(JSON.parse(row.details)).toEqual({ foo: 'bar' })
  })
})
