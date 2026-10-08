export type CashEntryType = 'in' | 'out' | 'expense'

export interface Shift {
  id: number
  userId: number
  userName: string
  openedAt: string
  openingCash: number
  closedAt: string | null
  expectedCash: number | null
  countedCash: number | null
  /** counted - expected; null while the shift is open. */
  difference: number | null
  note: string | null
}

export interface CashEntry {
  id: number
  shiftId: number
  type: CashEntryType
  amount: number
  note: string | null
  userId: number
  userName: string
  createdAt: string
}

/** Every number that moves the drawer, all in paisa. expectedCash is the formula result. */
export interface ShiftCash {
  openingCash: number
  cashSales: number
  /** Cash returned to customers on returns + on voids paid out of this drawer. */
  cashRefunds: number
  cashIn: number
  cashOut: number
  expenses: number
  /** Cash paid to suppliers (with a purchase or as a separate payment). */
  supplierPaid: number
  /** Cash received from customers against their khata. */
  customerPaid: number
  expectedCash: number
}

export interface ShiftDetail {
  shift: Shift
  cash: ShiftCash
  entries: CashEntry[]
}

export interface OpenShiftInput {
  openingCash: number
}

export interface CashEntryInput {
  shiftId: number
  type: CashEntryType
  amount: number
  note?: string | null
}

export interface CloseShiftInput {
  shiftId: number
  countedCash: number
  note?: string | null
}

export interface ZReport {
  shift: Shift
  cash: ShiftCash
  /** Completed sales of this shift (voided ones are excluded). */
  sales: { count: number; subtotal: number; discount: number; total: number }
  byPayment: { cash: number; credit: number }
  returns: { count: number; total: number; cash: number; credit: number }
  voids: { count: number; total: number }
  entries: CashEntry[]
  generatedAt: string
}
