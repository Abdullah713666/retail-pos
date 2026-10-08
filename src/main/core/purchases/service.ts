/**
 * Purchases (stock in). createPurchase writes the purchase, lines, lots, stock movements,
 * stock cache, supplier ledger and audit in ONE db.transaction(). Totals are always
 * recomputed here; the renderer only sends quantities and unit costs.
 *
 * Ledger: purchase = CREDIT for the bill total (we owe the supplier); if something is paid
 * now, a payment_out DEBIT for the paid amount (a cash purchase nets to zero).
 * Cost: each line's cost per BASE unit = round half-up(unitCost / unitFactor). It is stored
 * on the lot and becomes the item's latest cost_price.
 * The cash drawer is not touched yet (cash shifts arrive in M9).
 */
import type Database from 'better-sqlite3'
import { ok, type Result } from '@shared/result'
import { nowLocal, todayLocal } from '@shared/dates'
import { multiplyPrice, roundHalfUp } from '@shared/money'
import type { CreatePurchaseInput, PurchaseDetail, PurchaseLineInput } from '@shared/types'
import { logAudit } from '../audit/service'
import { postEntry } from '../ledger/service'
import { findOrCreateLot, postMovement } from '../stock/service'
import { abort, must, runAtomic } from '../../db/tx'
import { getPurchase } from './queries'

export { listPurchases, getPurchase } from './queries'
export { returnPurchase } from './returns'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_MONEY = Number.MAX_SAFE_INTEGER

interface ItemInfo {
  id: number
  name: string
  base_unit: string
  track_stock: number
  track_lots: number
  active: number
}

interface ResolvedLine {
  input: PurchaseLineInput
  item: ItemInfo
  unitName: string
  factor: number
  qtyBase: number
  lineTotal: number
  baseCost: number
  lotNo: string | null
  expiry: string | null
}

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

function resolveLine(db: Database.Database, line: PurchaseLineInput, n: number): ResolvedLine {
  const item = db
    .prepare('SELECT id, name, base_unit, track_stock, track_lots, active FROM items WHERE id = ?')
    .get(line.itemId) as ItemInfo | undefined
  if (!item) abort('ITEM_NOT_FOUND', `Line ${n}: item not found`)
  if (!item.active) abort('ITEM_INACTIVE', `Line ${n}: ${item.name} is deactivated`)
  if (!item.track_stock) abort('ITEM_NOT_STOCKED', `Line ${n}: ${item.name} does not track stock`)
  if (!Number.isSafeInteger(line.qty) || line.qty <= 0) {
    abort('INVALID_QTY', `Line ${n}: quantity must be a whole number above zero`)
  }
  if (!Number.isSafeInteger(line.unitCost) || line.unitCost < 0) {
    abort('INVALID_PRICE', `Line ${n}: cost must be a whole number of paisa, not negative`)
  }

  let unitName = item.base_unit
  let factor = 1
  const wanted = line.unitName?.trim()
  if (wanted && wanted.toLowerCase() !== item.base_unit.toLowerCase()) {
    const unit = db
      .prepare('SELECT name, factor FROM item_units WHERE item_id = ? AND LOWER(name) = LOWER(?)')
      .get(item.id, wanted) as { name: string; factor: number } | undefined
    if (!unit) abort('UNIT_NOT_FOUND', `Line ${n}: ${item.name} has no unit "${wanted}"`)
    unitName = unit.name
    factor = unit.factor
  }

  let lotNo: string | null = null
  let expiry: string | null = null
  if (item.track_lots) {
    lotNo = line.lotNo?.trim() || null
    expiry = line.expiryDate?.trim() || null
    if (!lotNo) abort('LOT_REQUIRED', `Line ${n}: ${item.name} needs a batch number`)
    if (!expiry) abort('EXPIRY_REQUIRED', `Line ${n}: ${item.name} needs an expiry date`)
    if (!isValidDate(expiry)) abort('INVALID_DATE', `Line ${n}: expiry must look like YYYY-MM-DD`)
  }

  const qtyBase = line.qty * factor
  const lineTotal = multiplyPrice(line.unitCost, line.qty)
  if (!Number.isSafeInteger(qtyBase) || !Number.isSafeInteger(lineTotal)) {
    abort('INVALID_AMOUNT', `Line ${n}: amount is too large`)
  }
  return {
    input: line,
    item,
    unitName,
    factor,
    qtyBase,
    lineTotal,
    baseCost: roundHalfUp(line.unitCost / factor),
    lotNo,
    expiry
  }
}

export function createPurchase(
  db: Database.Database,
  input: CreatePurchaseInput,
  userId: number
): Result<PurchaseDetail> {
  const run = db.transaction((): number => {
    const supplier = db
      .prepare('SELECT type, active, name FROM parties WHERE id = ?')
      .get(input.supplierId) as { type: string; active: number; name: string } | undefined
    if (!supplier) abort('PARTY_NOT_FOUND', 'Supplier not found')
    if (supplier.type !== 'supplier') abort('WRONG_PARTY_TYPE', 'Choose a supplier, not a customer')
    if (!supplier.active) abort('PARTY_INACTIVE', 'This supplier is deactivated. Reactivate it first.')

    if (!input.lines || input.lines.length === 0) abort('NO_LINES', 'Add at least one item')

    const date = input.date?.trim() || todayLocal()
    if (!isValidDate(date)) abort('INVALID_DATE', 'Date must look like YYYY-MM-DD')
    if (date > todayLocal()) abort('INVALID_DATE', 'Purchase date cannot be in the future')

    const lines = input.lines.map((l, i) => resolveLine(db, l, i + 1))
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
    const discount = input.discount ?? 0
    if (!Number.isSafeInteger(discount) || discount < 0 || discount > subtotal) {
      abort('INVALID_DISCOUNT', 'Discount cannot be negative or more than the bill')
    }
    const total = subtotal - discount
    const paid = input.paid ?? 0
    if (!Number.isSafeInteger(paid) || paid < 0 || paid > total || paid > MAX_MONEY) {
      abort('INVALID_PAYMENT', 'Paid amount cannot be negative or more than the bill total')
    }

    const now = nowLocal()
    const ledgerAt = `${date} ${now.slice(11)}`
    const billNo = input.billNo?.trim() || null
    const note = input.note?.trim() || null

    const info = db
      .prepare(
        `INSERT INTO purchases (supplier_id, bill_no, subtotal, discount, total, paid, note, user_id, created_at, purchase_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(input.supplierId, billNo, subtotal, discount, total, paid, note, userId, now, date)
    const purchaseId = Number(info.lastInsertRowid)

    const insertLine = db.prepare(
      `INSERT INTO purchase_lines (purchase_id, item_id, lot_id, lot_no, expiry_date, unit_name,
                                   unit_factor, qty, qty_base, unit_cost, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const l of lines) {
      let lotId: number | null = null
      if (l.lotNo) {
        lotId = must(
          findOrCreateLot(db, {
            itemId: l.item.id,
            lotNo: l.lotNo,
            expiryDate: l.expiry,
            costPrice: l.baseCost
          })
        )
      }
      insertLine.run(
        purchaseId, l.item.id, lotId, l.lotNo, l.expiry, l.unitName,
        l.factor, l.input.qty, l.qtyBase, l.input.unitCost, l.lineTotal
      )
      must(
        postMovement(db, {
          itemId: l.item.id,
          lotId,
          qty: l.qtyBase,
          type: 'purchase',
          refType: 'purchase',
          refId: purchaseId,
          userId
        })
      )
      // Latest cost wins (ARCHITECTURE is silent; this keeps item cost current).
      db.prepare('UPDATE items SET cost_price = ?, updated_at = ? WHERE id = ?').run(l.baseCost, now, l.item.id)
    }

    if (total > 0) {
      must(
        postEntry(db, {
          partyId: input.supplierId,
          type: 'purchase',
          credit: total,
          refType: 'purchase',
          refId: purchaseId,
          note: billNo ? `Bill ${billNo}` : null,
          userId,
          createdAt: ledgerAt
        })
      )
    }
    if (paid > 0) {
      must(
        postEntry(db, {
          partyId: input.supplierId,
          type: 'payment_out',
          debit: paid,
          refType: 'purchase',
          refId: purchaseId,
          note: billNo ? `Paid with bill ${billNo}` : 'Paid with purchase',
          userId,
          createdAt: ledgerAt
        })
      )
    }

    logAudit(db, {
      userId,
      action: 'purchase_created',
      entity: 'purchases',
      entityId: purchaseId,
      details: { supplierId: input.supplierId, billNo, lines: lines.length, total, paid }
    })
    return purchaseId
  })

  const res = runAtomic(() => run())
  if (!res.ok) return res
  return ok(getPurchase(db, res.data)!)
}

