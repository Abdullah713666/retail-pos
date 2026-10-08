export type PartyType = 'customer' | 'supplier'

export type LedgerEntryType =
  | 'opening'
  | 'sale'
  | 'payment_in'
  | 'purchase'
  | 'payment_out'
  | 'return'
  | 'adjust'

/**
 * `balance` is SUM(debit - credit) in paisa, for BOTH customers and suppliers:
 *   balance > 0  -> the party owes the shop (receivable)
 *   balance < 0  -> the shop owes the party (payable / advance)
 */
export interface Party {
  id: number
  type: PartyType
  name: string
  phone: string | null
  address: string | null
  creditLimit: number // paisa, customers only
  active: number
  createdAt: string
  balance: number // paisa, see sign convention above
}

export interface CreatePartyInput {
  type: PartyType
  name: string
  phone?: string | null
  address?: string | null
  creditLimit?: number
  /** Amount owed at start (paisa, >= 0): customer owes shop, or shop owes supplier. */
  openingBalance?: number
}

export interface UpdatePartyInput {
  id: number
  name: string
  phone?: string | null
  address?: string | null
  creditLimit?: number
}

export interface PartyFilter {
  type: PartyType
  query?: string
  activeOnly?: boolean
  page?: number
  pageSize?: number
}

export interface PartyListResult {
  parties: Party[]
  total: number
  page: number
  pageSize: number
}

export interface LedgerEntry {
  id: number
  partyId: number
  type: LedgerEntryType
  refType: string | null
  refId: number | null
  debit: number
  credit: number
  note: string | null
  userId: number | null
  createdAt: string
  /** Running balance after this entry (statements only). */
  balance: number
}

export interface StatementInput {
  partyId: number
  from?: string // YYYY-MM-DD, inclusive
  to?: string // YYYY-MM-DD, inclusive
}

export interface Statement {
  partyId: number
  from: string | null
  to: string | null
  openingBalance: number
  entries: LedgerEntry[]
  totalDebit: number
  totalCredit: number
  closingBalance: number
}

export interface RecordPaymentInput {
  partyId: number
  amount: number // paisa, > 0
  note?: string | null
}
