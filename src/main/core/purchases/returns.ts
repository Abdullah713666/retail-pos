/**
 * Purchase return: sends goods back to the supplier against an existing purchase.
 * One transaction: return rows, NEGATIVE stock movements (lot-aware, never below zero),
 * stock cache, and a supplier ledger DEBIT of type 'return' (we owe them less).
 * Refund per line = qty share of the line total, rounded half-up; the final return of a
 * line refunds the exact remainder so partial returns never add up to more than the bill.
 */
import type Database from 'better-sqlite3'
import { ok, type Result } from '@shared/result'
import { nowLocal } from '@shared/dates'
import { roundHalfUp } from '@shared/money'
import type { PurchaseReturnInput, PurchaseReturnResult } from '@shared/types'
import { logAudit } from '../audit/service'
import { postEntry } from '../ledger/service'
import { postMovement } from '../stock/service'
import { abort, must, runAtomic } from '../../db/tx'

interface LineRow {
  id: number
  item_id: number
  lot_id: number | null
  qty_base: number
  line_total: number
  returned_base: number
  returned_total: number
}

export function returnPurchase(
  db: Database.Database,
  input: PurchaseReturnInput,
  userId: number
): Result<PurchaseReturnResult> {
  const run = db.transaction((): PurchaseReturnResult => {
    const purchase = db
      .prepare('SELECT id, supplier_id, bill_no FROM purchases WHERE id = ?')
      .get(input.purchaseId) as { id: number; supplier_id: number; bill_no: string | null } | undefined
    if (!purchase) abort('NOT_FOUND', 'Purchase not found')
    if (!input.lines || input.lines.length === 0) abort('NO_LINES', 'Choose at least one item to return')

    const seen = new Set<number>()
    const lineStmt = db.prepare(
      `SELECT pl.id, pl.item_id, pl.lot_id, pl.qty_base, pl.line_total,
              COALESCE(SUM(rl.qty_base), 0) AS returned_base,
              COALESCE(SUM(rl.line_total), 0) AS returned_total
       FROM purchase_lines pl
       LEFT JOIN purchase_return_lines rl ON rl.purchase_line_id = pl.id
       WHERE pl.id = ? AND pl.purchase_id = ?
       GROUP BY pl.id`
    )

    const now = nowLocal()
    const info = db
      .prepare(
        `INSERT INTO purchase_returns (purchase_id, supplier_id, total, note, user_id, created_at)
         VALUES (?, ?, 0, ?, ?, ?)`
      )
      .run(purchase.id, purchase.supplier_id, input.note?.trim() || null, userId, now)
    const returnId = Number(info.lastInsertRowid)

    const insertLine = db.prepare(
      `INSERT INTO purchase_return_lines (return_id, purchase_line_id, item_id, lot_id, qty_base, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    let total = 0
    for (const l of input.lines) {
      if (seen.has(l.purchaseLineId)) abort('DUPLICATE_LINE', 'The same line was sent twice')
      seen.add(l.purchaseLineId)
      if (!Number.isSafeInteger(l.qtyBase) || l.qtyBase <= 0) {
        abort('INVALID_QTY', 'Return quantity must be a whole number above zero')
      }
      const row = lineStmt.get(l.purchaseLineId, purchase.id) as LineRow | undefined
      if (!row) abort('LINE_NOT_FOUND', 'That line does not belong to this purchase')
      const left = row.qty_base - row.returned_base
      if (l.qtyBase > left) {
        abort('RETURN_TOO_MUCH', `Only ${left} can still be returned for this line`)
      }
      const refund =
        l.qtyBase === left
          ? row.line_total - row.returned_total
          : roundHalfUp((row.line_total * l.qtyBase) / row.qty_base)

      insertLine.run(returnId, row.id, row.item_id, row.lot_id, l.qtyBase, refund)
      must(
        postMovement(db, {
          itemId: row.item_id,
          lotId: row.lot_id,
          qty: -l.qtyBase,
          type: 'purchase_return',
          refType: 'purchase_return',
          refId: returnId,
          userId
        })
      )
      total += refund
    }

    db.prepare('UPDATE purchase_returns SET total = ? WHERE id = ?').run(total, returnId)
    if (total > 0) {
      must(
        postEntry(db, {
          partyId: purchase.supplier_id,
          type: 'return',
          debit: total,
          refType: 'purchase_return',
          refId: returnId,
          note: purchase.bill_no ? `Return against bill ${purchase.bill_no}` : `Return against purchase #${purchase.id}`,
          userId
        })
      )
    }
    logAudit(db, {
      userId,
      action: 'purchase_returned',
      entity: 'purchases',
      entityId: purchase.id,
      details: { returnId, total, lines: input.lines.length }
    })
    return { returnId, total }
  })

  const res = runAtomic(() => run())
  return res.ok ? ok(res.data) : res
}
