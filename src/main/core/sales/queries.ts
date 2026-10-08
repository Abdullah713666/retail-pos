import type Database from 'better-sqlite3'
import type { Sale, SaleFilter, SaleLine, SaleStatus, SaleSummary } from '@shared/types'

interface SaleRow {
  id: number
  invoice_no: string | null
  party_id: number | null
  party_name: string | null
  user_id: number
  status: SaleStatus
  subtotal: number
  discount: number
  bill_discount: number
  bill_discount_bp: number | null
  total: number
  paid_cash: number
  paid_credit: number
  note: string | null
  created_at: string
  voided_at: string | null
  void_reason: string | null
}

interface LineRow {
  id: number
  item_id: number
  item_name: string
  lot_id: number | null
  unit_id: number | null
  unit_name: string
  unit_factor: number
  qty: number
  qty_base: number
  unit_price: number
  discount: number
  discount_bp: number | null
  line_total: number
  net_total: number
  returned_base: number
}

export function getSale(db: Database.Database, id: number): Sale | null {
  const s = db
    .prepare(
      `SELECT s.*, p.name AS party_name FROM sales s LEFT JOIN parties p ON p.id = s.party_id WHERE s.id = ?`
    )
    .get(id) as SaleRow | undefined
  if (!s) return null

  const lines = db
    .prepare(
      `SELECT sl.*,
              (SELECT u.id FROM item_units u WHERE u.item_id = sl.item_id AND u.name = sl.unit_name) AS unit_id,
              COALESCE((SELECT SUM(r.qty_base) FROM sale_return_lines r WHERE r.sale_line_id = sl.id), 0) AS returned_base
       FROM sale_lines sl WHERE sl.sale_id = ? ORDER BY sl.id`
    )
    .all(id) as LineRow[]
  const lotRows = db
    .prepare(
      `SELECT sll.sale_line_id, sll.lot_id, sll.qty_base, l.lot_no, l.expiry_date
       FROM sale_line_lots sll JOIN stock_lots l ON l.id = sll.lot_id
       JOIN sale_lines sl ON sl.id = sll.sale_line_id
       WHERE sl.sale_id = ? ORDER BY sll.id`
    )
    .all(id) as Array<{ sale_line_id: number; lot_id: number; qty_base: number; lot_no: string; expiry_date: string | null }>
  const returned = db
    .prepare('SELECT COALESCE(SUM(total), 0) AS t FROM sale_returns WHERE sale_id = ?')
    .get(id) as { t: number }

  return {
    id: s.id,
    invoiceNo: s.invoice_no,
    partyId: s.party_id,
    partyName: s.party_name,
    userId: s.user_id,
    status: s.status,
    subtotal: s.subtotal,
    discount: s.discount,
    billDiscount: s.bill_discount,
    billDiscountBp: s.bill_discount_bp,
    total: s.total,
    paidCash: s.paid_cash,
    paidCredit: s.paid_credit,
    note: s.note,
    createdAt: s.created_at,
    voidedAt: s.voided_at,
    voidReason: s.void_reason,
    returnedTotal: returned.t,
    lines: lines.map(
      (l): SaleLine => ({
        id: l.id,
        itemId: l.item_id,
        itemName: l.item_name,
        lotId: l.lot_id,
        unitId: l.unit_id,
        unitName: l.unit_name,
        unitFactor: l.unit_factor,
        qty: l.qty,
        qtyBase: l.qty_base,
        unitPrice: l.unit_price,
        discount: l.discount,
        discountBp: l.discount_bp,
        lineTotal: l.line_total,
        netTotal: l.net_total,
        returnedBase: l.returned_base,
        lots: lotRows
          .filter((r) => r.sale_line_id === l.id)
          .map((r) => ({ lotId: r.lot_id, lotNo: r.lot_no, expiryDate: r.expiry_date, qtyBase: r.qty_base }))
      })
    )
  }
}

export function getSaleByInvoice(db: Database.Database, invoiceNo: string): Sale | null {
  const row = db.prepare('SELECT id FROM sales WHERE invoice_no = ?').get(invoiceNo.trim()) as
    | { id: number }
    | undefined
  return row ? getSale(db, row.id) : null
}

export function listSales(db: Database.Database, filter: SaleFilter): SaleSummary[] {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200)
  const q = filter.query?.trim()
  const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null
  const rows = db
    .prepare(
      `SELECT s.id, s.invoice_no, p.name AS party_name, s.status, s.total, s.created_at,
              (SELECT COUNT(*) FROM sale_lines l WHERE l.sale_id = s.id) AS line_count
       FROM sales s LEFT JOIN parties p ON p.id = s.party_id
       WHERE (? IS NULL OR s.status = ?)
         AND (? IS NULL OR s.invoice_no LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\')
       ORDER BY s.id DESC LIMIT ?`
    )
    .all(filter.status ?? null, filter.status ?? null, like, like, like, limit) as Array<{
    id: number
    invoice_no: string | null
    party_name: string | null
    status: SaleStatus
    total: number
    created_at: string
    line_count: number
  }>
  return rows.map((r) => ({
    id: r.id,
    invoiceNo: r.invoice_no,
    partyName: r.party_name,
    status: r.status,
    total: r.total,
    createdAt: r.created_at,
    lineCount: r.line_count
  }))
}
