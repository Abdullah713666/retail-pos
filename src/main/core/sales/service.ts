/**
 * Sales. completeSale is the heart of the app: it re-prices every line from the database,
 * allocates stock, and writes sale + lines + stock movements + customer khata + invoice
 * number + audit + module hooks in ONE db.transaction(). Any failure rolls all of it back,
 * including the invoice counter, so invoice numbers never skip.
 *
 * Money: line_total = unit_price*qty - line discount (percent discounts round half-up);
 * the bill discount is shared across lines (largest remainder) into sale_lines.net_total, so
 * SUM(net_total) = sales.total exactly. sales.subtotal = sum of gross, sales.discount =
 * line discounts + bill discount, sales.total = subtotal - discount.
 *
 * Payment: paid_cash is the cash that STAYS in the drawer for this bill (total - credit);
 * any extra cash handed over is change. paid_credit goes to the customer's khata as a
 * 'sale' debit via the ledger service.
 *
 * Insufficient stock: blocked by default. Setting `allow_negative_stock` = '1' lets items that
 * track stock (but not lots) go below zero; lot items are always blocked (you cannot sell a
 * batch you do not have). Credit limit: parties.credit_limit > 0 is a hard block
 * (balance + new credit must stay within it); 0 means no limit. There is no override.
 *
 * A sale needs an open cash shift (NO_OPEN_SHIFT otherwise); its id is stored in sales.shift_id.
 *
 * Held bills are rows with status 'held' and no invoice number. Completing a recalled bill
 * UPDATES that same row (no duplicate). Discarding a held bill deletes the draft: it never
 * became a business record (no stock, no ledger, no invoice).
 */
import type Database from 'better-sqlite3'
import { ok, type Result } from '@shared/result'
import { nowLocal } from '@shared/dates'
import { formatPKR } from '@shared/money'
import type { CompleteSaleInput, CompleteSaleResult, Sale, SaleDraftInput } from '@shared/types'
import { abort, must, runAtomic } from '../../db/tx'
import { requireApproval } from './approval'
import { logAudit } from '../audit/service'
import { postEntry, getBalance } from '../ledger/service'
import { postMovement } from '../stock/service'
import { defaultAllocator } from '../stock/allocator'
import { getSetting, setSetting } from '../settings/service'
import { getOpenShiftId } from '../cash/service'
import { getActiveModules, getStockAllocator } from '../../modules/registry'
import type { AllocateContext, MainModule, StockAllocator } from '../../modules/types'
import { priceDraft, type PricedLine } from './pricing'
import { getSale } from './queries'

export { getSale, getSaleByInvoice, listSales } from './queries'
export { returnSale, voidSale } from './returns'

export interface SaleDeps {
  modules?: MainModule[]
}

function checkParty(db: Database.Database, partyId: number | null | undefined): number | null {
  if (partyId == null) return null
  const p = db.prepare('SELECT type, active FROM parties WHERE id = ?').get(partyId) as
    | { type: string; active: number }
    | undefined
  if (!p) abort('PARTY_NOT_FOUND', 'Customer not found')
  if (p.type !== 'customer') abort('WRONG_PARTY_TYPE', 'Choose a customer, not a supplier')
  if (!p.active) abort('PARTY_INACTIVE', 'This customer is deactivated. Reactivate it first.')
  return partyId
}

function nextInvoiceNo(db: Database.Database): string {
  let n = Number.parseInt(getSetting(db, 'next_invoice_no') ?? '1', 10)
  if (!Number.isSafeInteger(n) || n < 1) n = 1
  const exists = db.prepare('SELECT 1 FROM sales WHERE invoice_no = ?')
  while (exists.get(String(n).padStart(6, '0'))) n++
  setSetting(db, 'next_invoice_no', String(n + 1))
  return String(n).padStart(6, '0')
}

interface Header {
  partyId: number | null
  userId: number
  status: 'held' | 'completed'
  invoiceNo: string | null
  subtotal: number
  discount: number
  billDiscount: number
  billDiscountBp: number | null
  total: number
  paidCash: number
  paidCredit: number
  note: string | null
  shiftId: number | null
}

/** Inserts a new sale row, or turns the held row `heldId` into this one (lines are rewritten). */
function writeHeader(db: Database.Database, h: Header, heldId: number | null | undefined): number {
  const now = nowLocal()
  if (heldId != null) {
    const row = db.prepare('SELECT status FROM sales WHERE id = ?').get(heldId) as
      | { status: string }
      | undefined
    if (!row || row.status !== 'held') {
      abort('HELD_NOT_FOUND', 'This held bill was already completed or removed')
    }
    db.prepare(
      `UPDATE sales SET invoice_no = ?, party_id = ?, user_id = ?, status = ?, subtotal = ?, discount = ?,
         bill_discount = ?, bill_discount_bp = ?, total = ?, paid_cash = ?, paid_credit = ?, note = ?, created_at = ?,
         shift_id = ?
       WHERE id = ?`
    ).run(
      h.invoiceNo, h.partyId, h.userId, h.status, h.subtotal, h.discount, h.billDiscount, h.billDiscountBp,
      h.total, h.paidCash, h.paidCredit, h.note, now, h.shiftId, heldId
    )
    db.prepare('DELETE FROM sale_lines WHERE sale_id = ?').run(heldId)
    return heldId
  }
  const info = db
    .prepare(
      `INSERT INTO sales (invoice_no, party_id, user_id, status, subtotal, discount, bill_discount,
         bill_discount_bp, total, paid_cash, paid_credit, note, created_at, shift_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      h.invoiceNo, h.partyId, h.userId, h.status, h.subtotal, h.discount, h.billDiscount, h.billDiscountBp,
      h.total, h.paidCash, h.paidCredit, h.note, now, h.shiftId
    )
  return Number(info.lastInsertRowid)
}

function insertLine(db: Database.Database, saleId: number, l: PricedLine, lotId: number | null): number {
  const info = db
    .prepare(
      `INSERT INTO sale_lines (sale_id, item_id, item_name, lot_id, unit_name, unit_factor, qty, qty_base,
         unit_price, discount, discount_bp, line_total, net_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      saleId, l.item.id, l.item.name, lotId, l.unitName, l.factor, l.qty, l.qtyBase, l.unitPrice,
      l.discount, l.discountBp, l.lineTotal, l.netTotal
    )
  return Number(info.lastInsertRowid)
}

/** Takes stock for one line through the allocator and records movements + lot chunks. */
function takeStock(
  db: Database.Database,
  saleId: number,
  l: PricedLine,
  allocator: StockAllocator,
  allowNegative: boolean,
  userId: number,
  overrideBy: number | null
): void {
  const setCost = db.prepare('UPDATE sale_lines SET cost_total = ? WHERE id = ?')
  if (!l.item.track_stock) {
    const lineId = insertLine(db, saleId, l, null)
    const c = db.prepare('SELECT cost_price FROM items WHERE id = ?').get(l.item.id) as { cost_price: number }
    setCost.run(l.qtyBase * c.cost_price, lineId)
    return
  }
  const chunks = allocator.allocate(db, l.item.id, l.qtyBase, { saleId, userId, overrideBy } satisfies AllocateContext).filter((c) => c.qtyBase > 0)
  let got = 0
  for (const c of chunks) {
    if (!Number.isSafeInteger(c.qtyBase)) abort('ALLOCATION_FAILED', `${l.item.name}: stock allocation failed`)
    got += c.qtyBase
  }
  if (got > l.qtyBase) abort('ALLOCATION_FAILED', `${l.item.name}: stock allocation failed`)
  const short = l.qtyBase - got
  if (short > 0) {
    if (l.item.track_lots || !allowNegative) {
      abort('INSUFFICIENT_STOCK', `Not enough stock for ${l.item.name}. Check the quantity or add stock first.`)
    }
    chunks.push({ lotId: null, qtyBase: short })
  }

  const lotId = chunks.length === 1 ? chunks[0].lotId : null
  const lineId = insertLine(db, saleId, l, lotId)
  const addChunk = db.prepare(
    'INSERT INTO sale_line_lots (sale_line_id, lot_id, qty_base, cost_price) VALUES (?, ?, ?, ?)'
  )
  const lotCost = db.prepare('SELECT cost_price FROM stock_lots WHERE id = ?')
  const itemCost = db.prepare('SELECT cost_price FROM items WHERE id = ?').get(l.item.id) as { cost_price: number }
  let costTotal = 0
  for (const c of chunks) {
    const cost = c.lotId != null ? (lotCost.get(c.lotId) as { cost_price: number } | undefined) : undefined
    const unitCost = cost?.cost_price ?? itemCost.cost_price
    addChunk.run(lineId, c.lotId, c.qtyBase, unitCost)
    costTotal += c.qtyBase * unitCost
    const res = postMovement(db, {
      itemId: l.item.id,
      lotId: c.lotId,
      qty: -c.qtyBase,
      type: 'sale',
      refType: 'sale',
      refId: saleId,
      userId,
      allowNegative: allowNegative && !l.item.track_lots
    })
    if (!res.ok) {
      abort(res.error.code, res.error.code === 'INSUFFICIENT_STOCK'
        ? `Not enough stock for ${l.item.name}. ${res.error.message}`
        : res.error.message)
    }
  }
  setCost.run(costTotal, lineId)
}

export function holdSale(db: Database.Database, input: SaleDraftInput, userId: number): Result<Sale> {
  const run = db.transaction((): number => {
    const partyId = checkParty(db, input.partyId)
    const priced = priceDraft(db, input)
    const t = priced.totals
    const saleId = writeHeader(
      db,
      {
        partyId, userId, status: 'held', invoiceNo: null, subtotal: t.subtotal, discount: t.discount,
        billDiscount: t.billDiscount, billDiscountBp: priced.billDiscountBp, total: t.total,
        paidCash: 0, paidCredit: 0, note: input.note?.trim() || null, shiftId: null
      },
      input.heldSaleId
    )
    for (const l of priced.lines) insertLine(db, saleId, l, null)
    logAudit(db, { userId, action: 'sale_held', entity: 'sales', entityId: saleId, details: { total: t.total } })
    return saleId
  })
  const res = runAtomic(() => run())
  return res.ok ? ok(getSale(db, res.data)!) : res
}

export function discardHeld(db: Database.Database, saleId: number, userId: number): Result<void> {
  const run = db.transaction((): void => {
    const row = db.prepare('SELECT status, total FROM sales WHERE id = ?').get(saleId) as
      | { status: string; total: number }
      | undefined
    if (!row || row.status !== 'held') abort('HELD_NOT_FOUND', 'This held bill was already completed or removed')
    db.prepare('DELETE FROM sales WHERE id = ?').run(saleId) // lines go with it (ON DELETE CASCADE)
    logAudit(db, { userId, action: 'held_sale_discarded', entity: 'sales', entityId: saleId, details: { total: row.total } })
  })
  return runAtomic(() => run())
}

export function completeSale(
  db: Database.Database,
  input: CompleteSaleInput,
  userId: number,
  deps: SaleDeps = {}
): Result<CompleteSaleResult> {
  const modules = deps.modules ?? getActiveModules()
  const allocator = getStockAllocator(modules) ?? defaultAllocator

  const run = db.transaction((): { saleId: number; changeDue: number } => {
    // Selling needs an open cash shift so every rupee in the drawer belongs to one.
    const shiftId = getOpenShiftId(db)
    if (shiftId == null) abort('NO_OPEN_SHIFT', 'Open a cash shift first (Cash screen), then sell.')
    // Owner PIN given after a module blocked a line (e.g. expired batch); only the owner may override.
    const overrideBy = input.overrideApproval ? requireApproval(db, input.overrideApproval, ['owner']) : null
    const partyId = checkParty(db, input.partyId)
    const priced = priceDraft(db, input)
    const total = priced.totals.total

    const { paidCash, paidCredit } = input
    for (const v of [paidCash, paidCredit]) {
      if (!Number.isSafeInteger(v) || v < 0) abort('INVALID_PAYMENT', 'Payment amounts cannot be negative')
    }
    if (paidCredit > total) abort('INVALID_PAYMENT', 'Credit amount is more than the bill total')
    const cashDue = total - paidCredit
    if (paidCash < cashDue) {
      abort('PAYMENT_SHORT', `Payment is short by ${formatPKR(cashDue - paidCash)}`)
    }
    if (paidCredit > 0) {
      if (partyId == null) abort('CUSTOMER_REQUIRED', 'Choose a customer to put an amount on credit')
      const limit = (db.prepare('SELECT credit_limit FROM parties WHERE id = ?').get(partyId) as { credit_limit: number }).credit_limit
      if (limit > 0) {
        const balance = getBalance(db, partyId)
        if (balance + paidCredit > limit) {
          const room = Math.max(limit - balance, 0)
          abort(
            'CREDIT_LIMIT_EXCEEDED',
            `Credit limit is ${formatPKR(limit)} and this customer already owes ${formatPKR(Math.max(balance, 0))}. At most ${formatPKR(room)} more can go on credit.`
          )
        }
      }
    }

    const invoiceNo = nextInvoiceNo(db)
    const t = priced.totals
    const saleId = writeHeader(
      db,
      {
        partyId, userId, status: 'completed', invoiceNo, subtotal: t.subtotal, discount: t.discount,
        billDiscount: t.billDiscount, billDiscountBp: priced.billDiscountBp, total,
        paidCash: cashDue, paidCredit, note: input.note?.trim() || null, shiftId
      },
      input.heldSaleId
    )

    const allowNegative = getSetting(db, 'allow_negative_stock') === '1'
    for (const l of priced.lines) takeStock(db, saleId, l, allocator, allowNegative, userId, overrideBy)

    if (paidCredit > 0 && partyId != null) {
      must(
        postEntry(db, {
          partyId, type: 'sale', debit: paidCredit, refType: 'sale', refId: saleId,
          note: `Invoice ${invoiceNo}`, userId
        })
      )
    }
    logAudit(db, {
      userId, action: 'sale_completed', entity: 'sales', entityId: saleId,
      details: { invoiceNo, total, paidCash: cashDue, paidCredit, lines: priced.lines.length, partyId }
    })
    for (const mod of modules) mod.onSaleCompleted?.({ db }, saleId)
    return { saleId, changeDue: paidCash - cashDue }
  })

  const res = runAtomic(() => run())
  if (!res.ok) return res
  return ok({ sale: getSale(db, res.data.saleId)!, changeDue: res.data.changeDue })
}
