export type SalesGroupBy = 'day' | 'item' | 'user'

/** Inclusive local dates, 'YYYY-MM-DD'. */
export interface DateRangeInput {
  from: string
  to: string
}

export interface SalesReportInput extends DateRangeInput {
  groupBy: SalesGroupBy
}

/** All money in paisa. profit = sales - returns - cost (cost of goods actually sold, net of returned goods). */
export interface SalesReportRow {
  key: string
  label: string
  /** Completed invoices in the range (0 for returns-only rows). */
  invoices: number
  /** Net quantity in base units (sold - returned); only filled when grouped by item. */
  qty: number | null
  sales: number
  returns: number
  cost: number
  profit: number
}

export interface SalesReport {
  groupBy: SalesGroupBy
  rows: SalesReportRow[]
  totals: { invoices: number; sales: number; returns: number; cost: number; profit: number }
}

export interface StockValueRow {
  itemId: number
  name: string
  qty: number
  baseUnit: string
  costPrice: number
  value: number
}

export interface StockValueReport {
  rows: StockValueRow[]
  totalValue: number
}

export interface LowStockRow {
  itemId: number
  name: string
  qty: number
  baseUnit: string
  reorderLevel: number
}

export interface BalanceRow {
  partyId: number
  name: string
  phone: string | null
  /** Always positive: how much the customer owes us / we owe the supplier. */
  amount: number
}

export interface BalanceReport {
  rows: BalanceRow[]
  total: number
}

export interface SaveCsvInput {
  suggestedName: string
  rows: Array<Array<string | number>>
}

export interface SaveCsvResult {
  saved: boolean
  path: string | null
}

export interface BackupFile {
  name: string
  size: number
  modifiedAt: string
}

export interface BackupStatus {
  backupDir: string
  lastBackupAt: string | null
  extraDir: string
  keep: number
  backups: BackupFile[]
}

export interface BackupNowResult {
  name: string
  /** Set when the extra folder could not be written (e.g. USB removed); the main backup still succeeded. */
  extraError: string | null
}

export interface RestoreInput {
  /** A file name from the backups list. Omit to pick any .db file with a file dialog. */
  name?: string
}

export interface RestoreResult {
  cancelled: boolean
}
