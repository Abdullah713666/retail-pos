export interface PurchaseLineInput {
  itemId: number
  /** Unit name: the item's base unit or one of its packs. Omit for the base unit. */
  unitName?: string | null
  qty: number // whole number of `unitName`
  unitCost: number // paisa per `unitName`
  lotNo?: string | null
  expiryDate?: string | null // YYYY-MM-DD
}

export interface CreatePurchaseInput {
  supplierId: number
  billNo?: string | null
  date?: string | null // YYYY-MM-DD, defaults to today
  lines: PurchaseLineInput[]
  discount?: number // paisa, bill level
  paid?: number // paisa paid now (0 = full credit, total = cash purchase)
  note?: string | null
}

export interface PurchaseLine {
  id: number
  itemId: number
  itemName: string
  baseUnit: string
  lotId: number | null
  lotNo: string | null
  expiryDate: string | null
  unitName: string
  unitFactor: number
  qty: number
  qtyBase: number
  unitCost: number
  lineTotal: number
  returnedBase: number
}

export interface Purchase {
  id: number
  supplierId: number
  supplierName: string
  billNo: string | null
  purchaseDate: string
  subtotal: number
  discount: number
  total: number
  paid: number
  returnedTotal: number
  note: string | null
  userId: number
  createdAt: string
}

export interface PurchaseReturnSummary {
  id: number
  total: number
  note: string | null
  createdAt: string
}

export interface PurchaseDetail extends Purchase {
  lines: PurchaseLine[]
  returns: PurchaseReturnSummary[]
}

export interface PurchaseFilter {
  supplierId?: number
  from?: string
  to?: string
  query?: string // bill no or supplier name
  page?: number
  pageSize?: number
}

export interface PurchaseListResult {
  purchases: Purchase[]
  total: number
  page: number
  pageSize: number
}

export interface PurchaseReturnInput {
  purchaseId: number
  lines: Array<{ purchaseLineId: number; qtyBase: number }>
  note?: string | null
}

export interface PurchaseReturnResult {
  returnId: number
  total: number
}
