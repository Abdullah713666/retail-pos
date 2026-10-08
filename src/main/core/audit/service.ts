import type Database from 'better-sqlite3'
import { nowLocal } from '@shared/dates'

export interface AuditEntry {
  userId?: number | null
  action: string
  entity: string
  entityId?: number | null
  details?: Record<string, unknown> | null
}

export function logAudit(db: Database.Database, entry: AuditEntry): void {
  db.prepare(`
    INSERT INTO audit_log (user_id, action, entity, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    entry.userId ?? null,
    entry.action,
    entry.entity,
    entry.entityId ?? null,
    entry.details ? JSON.stringify(entry.details) : null,
    nowLocal()
  )
}
