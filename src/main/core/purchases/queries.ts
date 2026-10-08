import type Database from 'better-sqlite3'
import type {
  Purchase,
  PurchaseDetail,
  PurchaseFilter,
  PurchaseLine,
  PurchaseListResult,
  PurchaseReturnSummary
} from '@shared/types'

interface PurchaseRow {
  id: number
  supplier_id: number
  supplier_name: string
  bill_no: string | null
  purchase_date: string
  subtotal: number
  discount: number
  total: number
  paid: number
  returned_total: number
  note: string | null
  user_id: number
  created_at: string
}

const SELECT_PURCHASE = `
  SELECT p.id, p.supplier_id, s.name AS supplier_name, p.bill_no,
         COALESCE(p.purchase_date, substr(p.created_at, 1, 10)) AS purchase_date,
         p.subtotal, p.discount, p.total, p.paid, p.note, p.user_id, p.created_at,
         COALESCE((SELECT SUM(r.total) FROM purchase_returns r WHERE r.purchase_id = p.id), 0) AS returned_total
  FROM purchases p
  JOIN parties s ON s.id = p.supplier_id
`

function mapPurchase(r: PurchaseRow): Purchase {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    billNo: r.bill_no,
    purchaseDate: r.purchase_date,
    subtotal: r.subtotal,
    discount: r.discount,
    total: r.total,
    paid: r.paid,
    returnedTotal: r.returned_total,
    note: r.note,
    userId: r.user_id,
    createdAt: r.created_at
  }
}

function escapeLike(word: string): string {
  return word.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export function listPurchases(db: Database.Database, filter: PurchaseFilter = {}): PurchaseListResult {
  const page = filter.page && filter.page > 0 ? filter.page : 1
  const pageSize = filter.pageSize && filter.pageSize > 0 ? Math.min(filter.pageSize, 200) : 20
  const where: string[] = []
  const params: Array<string | number> = []
  if (filter.supplierId) {
    where.push('p.supplier_id = ?')
    params.push(filter.supplierId)
  }
  if (filter.from) {
    where.push('COALESCE(p.purchase_date, substr(p.created_at, 1, 10)) >= ?')
    params.push(filter.from)
  }
  if (filter.to) {
    where.push('COALESCE(p.purchase_date, substr(p.created_at, 1, 10)) <= ?')
    params.push(filter.to)
  }
  const q = filter.query?.trim().toLowerCase()
  if (q) {
    where.push(`(LOWER(COALESCE(p.bill_no, '')) LIKE ? ESCAPE '\\' OR LOWER(s.name) LIKE ? ESCAPE '\\')`)
    params.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const total = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM purchases p JOIN parties s ON s.id = p.supplier_id ${whereSql}`)
      .get(...params) as { n: number }
  ).n
  const rows = db
    .prepare(`${SELECT_PURCHASE} ${whereSql} ORDER BY p.id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as PurchaseRow[]
  return { purchases: rows.map(mapPurchase), total, page, pageSize }
}

export function getPurchase(db: Database.Database, id: number): PurchaseDetail | null {
  const row = db.prepare(`${SELECT_PURCHASE} WHERE p.id = ?`).get(id) as PurchaseRow | undefined
  if (!row) return null

  const lines = db
    .prepare(
      `SELECT pl.id, pl.item_id AS itemId, i.name AS itemName, i.base_unit AS baseUnit,
              pl.lot_id AS lotId, pl.lot_no AS lotNo, pl.expiry_date AS expiryDate,
              pl.unit_name AS unitName, pl.unit_factor AS unitFactor, pl.qty,
              pl.qty_base AS qtyBase, pl.unit_cost AS unitCost, pl.line_total AS lineTotal,
              COALESCE((SELECT SUM(rl.qty_base) FROM purchase_return_lines rl
                        WHERE rl.purchase_line_id = pl.id), 0) AS returnedBase
       FROM purchase_lines pl JOIN items i ON i.id = pl.item_id
       WHERE pl.purchase_id = ? ORDER BY pl.id`
    )
    .all(id) as PurchaseLine[]
  const returns = db
    .prepare(
      `SELECT id, total, note, created_at AS createdAt
       FROM purchase_returns WHERE purchase_id = ? ORDER BY id`
    )
    .all(id) as PurchaseReturnSummary[]
  return { ...mapPurchase(row), lines, returns }
}
