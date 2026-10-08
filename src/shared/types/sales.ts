export type SaleStatus = 'held' | 'completed' | 'void'

export interface SaleLineInput {
  itemId: number
  /** item_units.id of the pack; null/omitted = the item's base unit. */
  unitId?: number | null
  qty: number // whole number of the chosen unit
  discount?: number // paisa, whole line
  discountBp?: number | null // percent in basis points (250 = 2.5%); wins over `discount`
}

/** What the screen sends to hold a bill. Prices and totals are NEVER sent: main recomputes them. */
export interface SaleDraftInput {
  partyId?: number | null
  lines: SaleLineInput[]
  billDiscount?: number // paisa
  billDiscountBp?: number | null
  note?: string | null
  /** Re-holding / completing a bill that was recalled: updates that row instead of creating another. */
  heldSaleId?: number | null
}

export interface CompleteSaleInput extends SaleDraftInput {
  /** Cash handed over (may be more than due; the difference is change). */
  paidCash: number
  /** Part of the total put on the customer's khata. */
  paidCredit: number
}

export interface SaleLine {
  id: number
  itemId: number
  itemName: string
  lotId: number | null
  unitId: number | null
  unitName: string
  unitFactor: number
  qty: number
  qtyBase: number
  unitPrice: number
  discount: number
  discountBp: number | null
  lineTotal: number
  netTotal: number
  returnedBase: number
}

export interface Sale {
  id: number
  invoiceNo: string | null
  partyId: number | null
  partyName: string | null
  userId: number
  status: SaleStatus
  subtotal: number
  discount: number
  billDiscount: number
  billDiscountBp: number | null
  total: number
  paidCash: number
  paidCredit: number
  note: string | null
  createdAt: string
  voidedAt: string | null
  voidReason: string | null
  returnedTotal: number
  lines: SaleLine[]
}

export interface CompleteSaleResult {
  sale: Sale
  changeDue: number
}

export interface SaleSummary {
  id: number
  invoiceNo: string | null
  partyName: string | null
  status: SaleStatus
  total: number
  createdAt: string
  lineCount: number
}

export interface SaleFilter {
  status?: SaleStatus
  query?: string // invoice number or customer name
  limit?: number
}

export interface Approval {
  userId: number
  pin: string
}

export interface SaleReturnInput {
  saleId: number
  lines: Array<{ saleLineId: number; qtyBase: number }>
  /** 'auto' (default): refund goes against the sale's unpaid khata first, the rest in cash. */
  refundTo?: 'auto' | 'cash' | 'credit'
  note?: string | null
  /** Required when the current user is a cashier. */
  approval?: Approval | null
}

export interface SaleReturnResult {
  returnId: number
  total: number
  refundCash: number
  refundCredit: number
}

export interface VoidSaleInput {
  saleId: number
  reason: string
  approval: Approval
}
