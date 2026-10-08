/**
 * Sale return (against an invoice) and void.
 *
 * Return: qty <= sold - already returned, per line. Refund = the line's net_total share
 * (after line + bill discount), half-up; the last piece of a line refunds the exact remainder
 * so partial returns never add up to more than was charged. Stock goes back to the SAME lot(s)
 * the sale took it from (oldest chunk first). Refund goes cash and/or onto the customer's khata
 * as a 'return' credit. A cashier needs a manager/owner PIN; manager/owner do not.
 *
 * Void: manager/owner PIN always (even if the current user is one). Only a completed sale with
 * no returns can be voided (return the goods instead otherwise). Reverses all stock to the
 * same lots and the khata credit part; marks the sale 'void' (rows stay for the audit trail).
 * Cash refunds (returns, voids) are tagged with the open shift (shift_id / void_shift_id) so the
 * drawer's expected cash drops by them; with no open shift they are simply not tracked.
 */
import type Database from 'better-sqlite3'
import { ok, type Result } from '@shared/result'
import { nowLocal } from '@shared/dates'
import type { Role, SaleReturnInput, SaleReturnResult, VoidSaleInput } from '@shared/types'
import { mulDivRoundHalfUp } from '@shared/sale-calc'
import { abort, must, runAtomic } from '../../db/tx'
import { logAudit } from '../audit/service'
import { postEntry } from '../ledger/service'
import { postMovement } from '../stock/service'
import { getOpenShiftId } from '../cash/service'
import { requireApproval } from './approval'

interface SaleHead {
  id: number
  invoice_no: string | null
  party_id: number | null
  status: string
  paid_cash: number
  paid_credit: number
}

interface LineRow {
  id: number
  item_id: number
  qty_base: number
  net_total: number
  returned_base: number
  returned_total: number
}

interface Chunk {
  lot_id: number | null
  qty_base: number
  returned: number
}

function loadSale(db: Database.Database, saleId: number): SaleHead {
  const s = db
    .prepare('SELECT id, invoice_no, party_id, status, paid_cash, paid_credit FROM sales WHERE id = ?')
    .get(saleId) as SaleHead | undefined
  if (!s) abort('NOT_FOUND', 'Sale not found')
  if (s.status === 'void') abort('SALE_VOID', 'This sale was voided')
  if (s.status !== 'completed') abort('SALE_NOT_COMPLETED', 'Only completed sales can be returned or voided')
  return s
}

function chunksOf(db: Database.Database, lineId: number): Chunk[] {
  const chunks = db
    .prepare('SELECT lot_id, qty_base FROM sale_line_lots WHERE sale_line_id = ? ORDER BY id')
    .all(lineId) as Array<{ lot_id: number | null; qty_base: number }>
  const ret = db.prepare(
    `SELECT COALESCE(SUM(qty_base), 0) AS q FROM sale_return_lines
     WHERE sale_line_id = ? AND lot_id IS ?`
  )
  return chunks.map((c) => ({
    ...c,
    returned: (ret.get(lineId, c.lot_id) as { q: number }).q
  }))
}

function totalReturnedFor(db: Database.Database, saleId: number): { cash: number; credit: number; count: number } {
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(refund_cash), 0) AS cash, COALESCE(SUM(refund_credit), 0) AS credit, COUNT(*) AS count
       FROM sale_returns WHERE sale_id = ?`
    )
    .get(saleId) as { cash: number; credit: number; count: number }
  return r
}

export function returnSale(
  db: Database.Database,
  input: SaleReturnInput,
  user: { id: number; role: Role }
): Result<SaleReturnResult> {
  const userId = user.id
  const run = db.transaction((): SaleReturnResult => {
    // Cashiers need a manager's PIN; managers and owners approve themselves.
    const approvedBy = user.role === 'cashier' ? requireApproval(db, input.approval) : user.id

    const sale = loadSale(db, input.saleId)
    if (!input.lines || input.lines.length === 0) abort('NO_LINES', 'Choose at least one item to return')

    const now = nowLocal()
    const head = db
      .prepare(
        `INSERT INTO sale_returns (sale_id, party_id, total, note, user_id, approved_by, created_at, shift_id)
         VALUES (?, ?, 0, ?, ?, ?, ?, ?)`
      )
      .run(sale.id, sale.party_id, input.note?.trim() || null, userId, approvedBy, now, getOpenShiftId(db))
    const returnId = Number(head.lastInsertRowid)

    const lineStmt = db.prepare(
      `SELECT sl.id, sl.item_id, sl.qty_base, sl.net_total,
              COALESCE((SELECT SUM(qty_base) FROM sale_return_lines WHERE sale_line_id = sl.id), 0) AS returned_base,
              COALESCE((SELECT SUM(line_total) FROM sale_return_lines WHERE sale_line_id = sl.id), 0) AS returned_total
       FROM sale_lines sl WHERE sl.id = ? AND sl.sale_id = ?`
    )
    const insertRet = db.prepare(
      `INSERT INTO sale_return_lines (return_id, sale_line_id, item_id, lot_id, qty_base, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    const track = db.prepare('SELECT track_stock FROM items WHERE id = ?')

    const seen = new Set<number>()
    let total = 0
    for (const l of input.lines) {
      if (seen.has(l.saleLineId)) abort('DUPLICATE_LINE', 'The same line was sent twice')
      seen.add(l.saleLineId)
      if (!Number.isSafeInteger(l.qtyBase) || l.qtyBase <= 0) {
        abort('INVALID_QTY', 'Return quantity must be a whole number above zero')
      }
      const row = lineStmt.get(l.saleLineId, sale.id) as LineRow | undefined
      if (!row) abort('LINE_NOT_FOUND', 'That line does not belong to this sale')
      const left = row.qty_base - row.returned_base
      if (l.qtyBase > left) abort('RETURN_TOO_MUCH', `Only ${left} can still be returned for this line`)
      const refund =
        l.qtyBase === left
          ? row.net_total - row.returned_total
          : mulDivRoundHalfUp(row.net_total, l.qtyBase, row.qty_base)

      // Put stock back into the lots the sale used, oldest chunk first.
      const chunks = chunksOf(db, row.id)
      let need = l.qtyBase
      let first = true
      const stocked = (track.get(row.item_id) as { track_stock: number }).track_stock === 1 && chunks.length > 0
      if (!stocked) {
        insertRet.run(returnId, row.id, row.item_id, null, l.qtyBase, refund)
      } else {
        for (const c of chunks) {
          if (need <= 0) break
          const take = Math.min(c.qty_base - c.returned, need)
          if (take <= 0) continue
          insertRet.run(returnId, row.id, row.item_id, c.lot_id, take, first ? refund : 0)
          first = false
          need -= take
          must(
            postMovement(db, {
              itemId: row.item_id, lotId: c.lot_id, qty: take, type: 'sale_return',
              refType: 'sale_return', refId: returnId, userId
            })
          )
        }
      }
      total += refund
    }

    // Split the refund between khata and cash.
    const prior = totalReturnedFor(db, sale.id)
    const creditLeft = Math.max(sale.paid_credit - prior.credit, 0)
    const cashLeft = Math.max(sale.paid_cash - prior.cash, 0)
    const mode = input.refundTo ?? 'auto'
    let refundCredit = 0
    if (mode === 'credit') refundCredit = total
    else if (mode === 'auto') refundCredit = Math.min(total, creditLeft)
    const refundCash = total - refundCredit
    if (refundCredit > 0 && sale.party_id == null) {
      abort('CUSTOMER_REQUIRED', 'This sale has no customer, so the refund must be in cash')
    }
    if (refundCash > cashLeft) {
      abort('REFUND_NOT_CASH', 'Part of this sale was on credit. Refund it to the customer account instead.')
    }

    db.prepare('UPDATE sale_returns SET total = ?, refund_cash = ?, refund_credit = ? WHERE id = ?').run(
      total, refundCash, refundCredit, returnId
    )
    if (refundCredit > 0 && sale.party_id != null) {
      must(
        postEntry(db, {
          partyId: sale.party_id, type: 'return', credit: refundCredit, refType: 'sale_return', refId: returnId,
          note: `Return against invoice ${sale.invoice_no}`, userId
        })
      )
    }
    logAudit(db, {
      userId, action: 'sale_returned', entity: 'sales', entityId: sale.id,
      details: { returnId, total, refundCash, refundCredit, approvedBy }
    })
    return { returnId, total, refundCash, refundCredit }
  })

  const res = runAtomic(() => run())
  return res.ok ? ok(res.data) : res
}

export function voidSale(db: Database.Database, input: VoidSaleInput, userId: number): Result<void> {
  const run = db.transaction((): void => {
    const approvedBy = requireApproval(db, input.approval)
    const reason = input.reason?.trim()
    if (!reason) abort('REASON_REQUIRED', 'Write a short reason for voiding this sale')
    const sale = loadSale(db, input.saleId)
    if (totalReturnedFor(db, sale.id).count > 0) {
      abort('HAS_RETURNS', 'This sale already has a return, so it cannot be voided')
    }

    const chunks = db
      .prepare(
        `SELECT sl.item_id, c.lot_id, c.qty_base FROM sale_line_lots c
         JOIN sale_lines sl ON sl.id = c.sale_line_id WHERE sl.sale_id = ? ORDER BY c.id`
      )
      .all(sale.id) as Array<{ item_id: number; lot_id: number | null; qty_base: number }>
    for (const c of chunks) {
      must(
        postMovement(db, {
          itemId: c.item_id, lotId: c.lot_id, qty: c.qty_base, type: 'sale_return',
          refType: 'sale_void', refId: sale.id, userId
        })
      )
    }
    if (sale.paid_credit > 0 && sale.party_id != null) {
      must(
        postEntry(db, {
          partyId: sale.party_id, type: 'return', credit: sale.paid_credit, refType: 'sale_void', refId: sale.id,
          note: `Void of invoice ${sale.invoice_no}`, userId
        })
      )
    }
    db.prepare(
      `UPDATE sales SET status = 'void', voided_at = ?, voided_by = ?, void_reason = ?, void_shift_id = ? WHERE id = ?`
    ).run(nowLocal(), approvedBy, reason, getOpenShiftId(db), sale.id)
    logAudit(db, {
      userId, action: 'sale_voided', entity: 'sales', entityId: sale.id,
      details: { invoiceNo: sale.invoice_no, reason, approvedBy }
    })
  })
  return runAtomic(() => run())
}
