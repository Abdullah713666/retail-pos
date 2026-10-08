/**
 * Turns what the screen sent (item ids, unit ids, qty, discounts) into priced lines.
 * Prices ALWAYS come from the database here; totals sent by the renderer do not exist.
 */
import type Database from 'better-sqlite3'
import type { SaleDraftInput, SaleLineInput } from '@shared/types'
import { billTotals, lineAmounts, unitPriceOf, type BillTotals } from '@shared/sale-calc'
import { abort } from '../../db/tx'

const MAX_QTY = 1_000_000_000
const MAX_AMOUNT = 10_000_000_000_000 // Rs 100 billion, far below 2^53 paisa

export interface ItemInfo {
  id: number
  name: string
  base_unit: string
  sale_price: number
  track_stock: number
  track_lots: number
  active: number
}

export interface PricedLine {
  input: SaleLineInput
  item: ItemInfo
  unitId: number | null
  unitName: string
  factor: number
  qty: number
  qtyBase: number
  unitPrice: number
  discount: number
  discountBp: number | null
  lineTotal: number
  netTotal: number
}

export interface PricedDraft {
  lines: PricedLine[]
  totals: BillTotals
  billDiscountBp: number | null
}

function isMoney(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= MAX_AMOUNT
}

function priceLine(db: Database.Database, line: SaleLineInput, n: number): PricedLine {
  const item = db
    .prepare('SELECT id, name, base_unit, sale_price, track_stock, track_lots, active FROM items WHERE id = ?')
    .get(line.itemId) as ItemInfo | undefined
  if (!item) abort('ITEM_NOT_FOUND', `Line ${n}: item not found`)
  if (!item.active) abort('ITEM_INACTIVE', `Line ${n}: ${item.name} is deactivated`)
  if (!Number.isSafeInteger(line.qty) || line.qty <= 0 || line.qty > MAX_QTY) {
    abort('INVALID_QTY', `Line ${n}: quantity must be a whole number above zero`)
  }

  let unitId: number | null = null
  let unitName = item.base_unit
  let factor = 1
  let packPrice: number | null = null
  if (line.unitId != null) {
    const unit = db
      .prepare('SELECT id, name, factor, sale_price FROM item_units WHERE id = ? AND item_id = ?')
      .get(line.unitId, item.id) as
      | { id: number; name: string; factor: number; sale_price: number | null }
      | undefined
    if (!unit) abort('UNIT_NOT_FOUND', `Line ${n}: ${item.name} has no such pack unit`)
    unitId = unit.id
    unitName = unit.name
    factor = unit.factor
    packPrice = unit.sale_price
  }

  const unitPrice = unitPriceOf(item.sale_price, factor, packPrice)
  const qtyBase = line.qty * factor
  if (!Number.isSafeInteger(qtyBase) || qtyBase > MAX_QTY * 1000) abort('INVALID_QTY', `Line ${n}: quantity is too large`)
  if (!Number.isSafeInteger(unitPrice * line.qty) || unitPrice * line.qty > MAX_AMOUNT) {
    abort('INVALID_AMOUNT', `Line ${n}: amount is too large`)
  }

  const discountBp = line.discountBp ?? null
  if (discountBp != null && (!Number.isSafeInteger(discountBp) || discountBp < 0 || discountBp > 10000)) {
    abort('INVALID_DISCOUNT', `Line ${n}: discount percent must be between 0 and 100`)
  }
  const flat = line.discount ?? 0
  if (!isMoney(flat)) abort('INVALID_DISCOUNT', `Line ${n}: discount cannot be negative`)
  const amounts = lineAmounts(unitPrice, line.qty, flat, discountBp)
  if (amounts.discount > amounts.gross) {
    abort('INVALID_DISCOUNT', `Line ${n}: discount is more than the line amount`)
  }
  return {
    input: line,
    item,
    unitId,
    unitName,
    factor,
    qty: line.qty,
    qtyBase,
    unitPrice,
    discount: amounts.discount,
    discountBp,
    lineTotal: amounts.lineTotal,
    netTotal: 0
  }
}

export function priceDraft(db: Database.Database, input: SaleDraftInput): PricedDraft {
  if (!input.lines || input.lines.length === 0) abort('NO_LINES', 'Add at least one item')
  const lines = input.lines.map((l, i) => priceLine(db, l, i + 1))

  const billDiscountBp = input.billDiscountBp ?? null
  if (billDiscountBp != null && (!Number.isSafeInteger(billDiscountBp) || billDiscountBp < 0 || billDiscountBp > 10000)) {
    abort('INVALID_DISCOUNT', 'Bill discount percent must be between 0 and 100')
  }
  const flat = input.billDiscount ?? 0
  if (!isMoney(flat)) abort('INVALID_DISCOUNT', 'Bill discount cannot be negative')

  const totals = billTotals(
    lines.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty, discount: l.discount, discountBp: null })),
    flat,
    billDiscountBp
  )
  if (totals.billDiscount > totals.subtotal - totals.lineDiscounts) {
    abort('INVALID_DISCOUNT', 'Bill discount is more than the bill total')
  }
  if (!Number.isSafeInteger(totals.total) || totals.total > MAX_AMOUNT) abort('INVALID_AMOUNT', 'Bill amount is too large')
  lines.forEach((l, i) => (l.netTotal = totals.netTotals[i]))
  return { lines, totals, billDiscountBp }
}
