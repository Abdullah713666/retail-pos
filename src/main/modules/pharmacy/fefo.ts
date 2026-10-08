/**
 * FEFO: First Expired, First Out. A sale line takes the batch (lot) with the earliest expiry first;
 * batches with no expiry go last. A batch is expired when expiry_date < today (local date, so a
 * batch is still sellable ON its expiry day). Expired batches are never used unless an owner
 * approved the override (PIN checked by the sale service) and each use is written to the audit log.
 */
import type Database from 'better-sqlite3'
import { todayLocal } from '@shared/dates'
import type { AllocationPreview, LotPreviewChunk } from '@shared/types'
import { abort } from '../../db/tx'
import { logAudit } from '../../core/audit/service'
import { defaultAllocator } from '../../core/stock/allocator'
import type { AllocateContext, StockAllocator } from '../types'

interface LotPlan {
  tracked: boolean
  valid: LotPreviewChunk[]
  expired: LotPreviewChunk[] // expired stock that would be needed to finish the line
  short: number // still missing after valid + expired
}

export function planLots(db: Database.Database, itemId: number, qtyBase: number, today = todayLocal()): LotPlan {
  const item = db.prepare('SELECT track_lots FROM items WHERE id = ?').get(itemId) as { track_lots: number } | undefined
  if (!item?.track_lots) return { tracked: false, valid: [], expired: [], short: 0 }

  const lots = db
    .prepare(
      `SELECT l.id, l.lot_no, l.expiry_date, COALESCE(SUM(m.qty), 0) AS stock
       FROM stock_lots l LEFT JOIN stock_movements m ON m.lot_id = l.id
       WHERE l.item_id = ?
       GROUP BY l.id HAVING stock > 0
       ORDER BY (l.expiry_date IS NULL), l.expiry_date, l.id`
    )
    .all(itemId) as Array<{ id: number; lot_no: string; expiry_date: string | null; stock: number }>

  const valid: LotPreviewChunk[] = []
  const expired: LotPreviewChunk[] = []
  let left = qtyBase
  const take = (into: LotPreviewChunk[], l: (typeof lots)[number], isExpired: boolean): void => {
    const q = Math.min(l.stock, left)
    into.push({ lotId: l.id, lotNo: l.lot_no, expiryDate: l.expiry_date, qtyBase: q, expired: isExpired })
    left -= q
  }
  const isExp = (l: (typeof lots)[number]): boolean => l.expiry_date !== null && l.expiry_date < today
  for (const l of lots) if (left > 0 && !isExp(l)) take(valid, l, false)
  for (const l of lots) if (left > 0 && isExp(l)) take(expired, l, true)
  return { tracked: true, valid, expired, short: left }
}

export function previewAllocation(db: Database.Database, itemId: number, qtyBase: number, today?: string): AllocationPreview {
  const p = planLots(db, itemId, qtyBase, today)
  const needsOverride = p.expired.length > 0 && p.short === 0
  const usable = p.valid.reduce((a, c) => a + c.qtyBase, 0)
  return {
    tracked: p.tracked,
    chunks: needsOverride ? [...p.valid, ...p.expired] : p.valid,
    needsOverride,
    shortBase: !p.tracked || needsOverride ? 0 : qtyBase - usable
  }
}

export const fefoAllocator: StockAllocator = {
  allocate(db: Database.Database, itemId: number, qtyBase: number, ctx: AllocateContext = {}) {
    const p = planLots(db, itemId, qtyBase)
    if (!p.tracked) return defaultAllocator.allocate(db, itemId, qtyBase)

    if (p.expired.length > 0 && p.short === 0) {
      if (!ctx.overrideBy) {
        const first = p.expired[0]
        const name = (db.prepare('SELECT name FROM items WHERE id = ?').get(itemId) as { name: string }).name
        abort(
          'OWNER_OVERRIDE_REQUIRED',
          `${name}: only expired stock is left for this quantity (batch ${first.lotNo}, expired ${first.expiryDate}). The owner must approve to sell it.`
        )
      }
      for (const c of p.expired) {
        logAudit(db, {
          userId: ctx.overrideBy,
          action: 'expired_sale_override',
          entity: 'stock_lots',
          entityId: c.lotId,
          details: { itemId, saleId: ctx.saleId ?? null, soldBy: ctx.userId ?? null, lotNo: c.lotNo, expiryDate: c.expiryDate, qtyBase: c.qtyBase }
        })
      }
      return [...p.valid, ...p.expired].map((c) => ({ lotId: c.lotId, qtyBase: c.qtyBase }))
    }
    // Not enough usable stock: return the valid part; the sale service reports INSUFFICIENT_STOCK.
    return p.valid.map((c) => ({ lotId: c.lotId, qtyBase: c.qtyBase }))
  }
}
