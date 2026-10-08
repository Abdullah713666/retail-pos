import type Database from 'better-sqlite3'
import { err, ok, type Result } from '@shared/result'
import { getSale } from '../sales/queries'
import { getBalance } from '../ledger/service'
import { getAllSettings } from '../settings/service'
import type { ReceiptData } from './receipt'

/** Loads everything a receipt needs for a saved sale. Read-only. */
export function loadReceiptData(db: Database.Database, saleId: number, cashReceived?: number | null): Result<ReceiptData> {
  const sale = getSale(db, saleId)
  if (!sale || sale.status === 'held' || !sale.invoiceNo) {
    return err({ code: 'NOT_FOUND', message: 'Only a finished sale can be printed' })
  }
  const s = getAllSettings(db)
  const cashier = (db.prepare('SELECT name FROM users WHERE id = ?').get(sale.userId) as { name: string } | undefined)?.name ?? ''
  return ok({
    shopName: s['shop_name'] || '',
    shopAddress: s['shop_address'] || '',
    shopPhone: s['shop_phone'] || '',
    footer: s['receipt_footer'] || '',
    invoiceNo: sale.invoiceNo,
    createdAt: sale.createdAt,
    cashier,
    customer: sale.partyName,
    lines: sale.lines.map((l) => ({
      name: l.itemName, qty: l.qty, unit: l.unitName, unitPrice: l.unitPrice, total: l.lineTotal
    })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    paidCash: sale.paidCash,
    paidCredit: sale.paidCredit,
    cashReceived: cashReceived ?? null,
    khataBalance: sale.partyId != null && sale.paidCredit > 0 ? getBalance(db, sale.partyId) : null,
    voided: sale.status === 'void'
  })
}
