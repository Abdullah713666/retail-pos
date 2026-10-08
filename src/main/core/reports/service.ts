/**
 * Reports. All aggregation happens in SQL (one grouped query per side, merged by key in JS), so a
 * shop with years of data does not trigger per-row queries. Money is integer paisa.
 *
 * Profit = net sales - returns - cost of goods sold:
 * - sales   = SUM(sale_lines.net_total) of COMPLETED sales created in the range (voided sales are skipped;
 *             net_total already carries each line's share of the bill discount).
 * - returns = SUM(sale_return_lines.line_total) of returns made in the range (by return date).
 * - cost    = SUM(sale_lines.cost_total) (frozen at sale time from lot cost / item cost) minus the cost of
 *             the returned quantity (cost_total * returned qty / sold qty of that line).
 * Receivables / payables use the ledger sign: balance = SUM(debit) - SUM(credit);
 * > 0 customer owes us, < 0 we owe the supplier.
 */
import type Database from 'better-sqlite3'
import type {
  BalanceReport,
  BalanceRow,
  DateRangeInput,
  LowStockRow,
  SalesGroupBy,
  SalesReport,
  SalesReportInput,
  SalesReportRow,
  StockValueReport,
  StockValueRow
} from '@shared/types'

interface GroupSpec {
  /** SQL expressions for key/label on a sales row (alias s, sl) and a return row (alias r, rl). */
  saleKey: string
  saleLabel: string
  retKey: string
  retLabel: string
  joins: string
  retJoins: string
}

const SPECS: Record<SalesGroupBy, GroupSpec> = {
  day: {
    saleKey: 'substr(s.created_at, 1, 10)',
    saleLabel: 'substr(s.created_at, 1, 10)',
    retKey: 'substr(r.created_at, 1, 10)',
    retLabel: 'substr(r.created_at, 1, 10)',
    joins: '',
    retJoins: ''
  },
  item: {
    saleKey: 'CAST(sl.item_id AS TEXT)',
    saleLabel: 'MAX(sl.item_name)',
    retKey: 'CAST(rl.item_id AS TEXT)',
    retLabel: 'MAX(sl.item_name)',
    joins: '',
    retJoins: ''
  },
  user: {
    saleKey: 'CAST(s.user_id AS TEXT)',
    saleLabel: 'MAX(u.name)',
    retKey: 'CAST(r.user_id AS TEXT)',
    retLabel: 'MAX(u.name)',
    joins: 'JOIN users u ON u.id = s.user_id',
    retJoins: 'JOIN users u ON u.id = r.user_id'
  }
}

// created_at >= from AND created_at < day after `to`: stays index-friendly and includes all of `to`.
const SALE_RANGE = "s.created_at >= ? AND s.created_at < date(?, '+1 day')"
const RET_RANGE = "r.created_at >= ? AND r.created_at < date(?, '+1 day')"

interface SaleAgg { grp: string; label: string; invoices: number; qty: number; net: number; cost: number }
interface RetAgg { grp: string; label: string; qty: number; amount: number; cost: number }

export function getSalesReport(db: Database.Database, input: SalesReportInput): SalesReport {
  const spec = SPECS[input.groupBy]
  const sold = db
    .prepare(
      `SELECT ${spec.saleKey} AS grp, ${spec.saleLabel} AS label, COUNT(DISTINCT s.id) AS invoices,
              SUM(sl.qty_base) AS qty, SUM(sl.net_total) AS net, SUM(sl.cost_total) AS cost
       FROM sales s JOIN sale_lines sl ON sl.sale_id = s.id ${spec.joins}
       WHERE s.status = 'completed' AND ${SALE_RANGE}
       GROUP BY grp`
    )
    .all(input.from, input.to) as SaleAgg[]
  const returned = db
    .prepare(
      `SELECT ${spec.retKey} AS grp, ${spec.retLabel} AS label, SUM(rl.qty_base) AS qty,
              SUM(rl.line_total) AS amount,
              CAST(ROUND(SUM(1.0 * sl.cost_total * rl.qty_base / NULLIF(sl.qty_base, 0))) AS INTEGER) AS cost
       FROM sale_returns r
       JOIN sale_return_lines rl ON rl.return_id = r.id
       JOIN sale_lines sl ON sl.id = rl.sale_line_id ${spec.retJoins}
       WHERE ${RET_RANGE}
       GROUP BY grp`
    )
    .all(input.from, input.to) as RetAgg[]

  const map = new Map<string, SalesReportRow>()
  const rowFor = (key: string, label: string): SalesReportRow => {
    let row = map.get(key)
    if (!row) {
      row = { key, label, invoices: 0, qty: input.groupBy === 'item' ? 0 : null, sales: 0, returns: 0, cost: 0, profit: 0 }
      map.set(key, row)
    }
    return row
  }
  for (const a of sold) {
    const row = rowFor(a.grp, a.label)
    row.invoices = a.invoices
    row.sales = a.net
    row.cost = a.cost
    if (row.qty != null) row.qty = a.qty
  }
  for (const a of returned) {
    const row = rowFor(a.grp, a.label)
    row.returns = a.amount
    row.cost -= a.cost ?? 0
    if (row.qty != null) row.qty -= a.qty
  }
  const rows = [...map.values()]
  for (const r of rows) r.profit = r.sales - r.returns - r.cost
  rows.sort((a, b) => (input.groupBy === 'day' ? a.key.localeCompare(b.key) : b.profit - a.profit))

  const invoices = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM sales s WHERE s.status = 'completed' AND ${SALE_RANGE}`)
      .get(input.from, input.to) as { n: number }
  ).n
  const totals = rows.reduce(
    (t, r) => ({ ...t, sales: t.sales + r.sales, returns: t.returns + r.returns, cost: t.cost + r.cost, profit: t.profit + r.profit }),
    { invoices, sales: 0, returns: 0, cost: 0, profit: 0 }
  )
  return { groupBy: input.groupBy, rows, totals }
}

/**
 * Stock value = quantity x cost. Lot-tracked items are valued lot by lot (each lot's own cost);
 * any stock without a lot (e.g. opening stock) and untracked items use the item's cost.
 */
export function getStockValue(db: Database.Database): StockValueReport {
  const rows = db
    .prepare(
      `SELECT i.id AS itemId, i.name, i.stock_cache AS qty, i.base_unit AS baseUnit, i.cost_price AS costPrice,
              CASE WHEN i.track_lots = 1
                THEN COALESCE(lv.val, 0) + (i.stock_cache - COALESCE(lv.qty, 0)) * i.cost_price
                ELSE i.stock_cache * i.cost_price END AS value
       FROM items i
       LEFT JOIN (
         SELECT m.item_id, SUM(m.qty) AS qty, SUM(m.qty * l.cost_price) AS val
         FROM stock_movements m JOIN stock_lots l ON l.id = m.lot_id
         GROUP BY m.item_id
       ) lv ON lv.item_id = i.id AND i.track_lots = 1
       WHERE i.active = 1 AND i.track_stock = 1 AND i.stock_cache > 0
       ORDER BY value DESC, i.name`
    )
    .all() as StockValueRow[]
  return { rows, totalValue: rows.reduce((t, r) => t + r.value, 0) }
}

export function getLowStock(db: Database.Database): LowStockRow[] {
  return db
    .prepare(
      `SELECT id AS itemId, name, stock_cache AS qty, base_unit AS baseUnit, reorder_level AS reorderLevel
       FROM items WHERE active = 1 AND track_stock = 1 AND stock_cache <= reorder_level
       ORDER BY (stock_cache - reorder_level), name`
    )
    .all() as LowStockRow[]
}

function balances(db: Database.Database, type: 'customer' | 'supplier'): BalanceReport {
  const sign = type === 'customer' ? 1 : -1
  const rows = db
    .prepare(
      `SELECT p.id AS partyId, p.name, p.phone, ? * (SUM(l.debit) - SUM(l.credit)) AS amount
       FROM parties p JOIN party_ledger l ON l.party_id = p.id
       WHERE p.type = ?
       GROUP BY p.id HAVING amount > 0
       ORDER BY amount DESC, p.name`
    )
    .all(sign, type) as BalanceRow[]
  return { rows, total: rows.reduce((t, r) => t + r.amount, 0) }
}

/** Customers who owe the shop (ledger balance > 0). */
export const getReceivables = (db: Database.Database): BalanceReport => balances(db, 'customer')
/** Suppliers the shop owes (ledger balance < 0, shown as a positive amount). */
export const getPayables = (db: Database.Database): BalanceReport => balances(db, 'supplier')

export function isValidRange(r: DateRangeInput): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(r.from) && /^\d{4}-\d{2}-\d{2}$/.test(r.to) && r.from <= r.to
}
