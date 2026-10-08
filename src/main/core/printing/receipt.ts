/**
 * Receipt builder: sale data -> HTML string. PURE (no electron, no db) so it is unit tested.
 * All money is integer paisa. Layout works for 58 mm and 80 mm paper; Urdu text renders RTL.
 */
import type { PaperWidth } from '@shared/types'
import { esc, htmlDocument, money, row } from './html'
import { labelsFor, type Lang } from './labels'

export interface ReceiptLine {
  name: string
  qty: number
  unit: string
  unitPrice: number
  /** After the line discount, before the bill discount. */
  total: number
}

export interface ReceiptData {
  shopName: string
  shopAddress: string
  shopPhone: string
  footer: string
  invoiceNo: string
  createdAt: string
  cashier: string
  customer: string | null
  lines: ReceiptLine[]
  subtotal: number
  discount: number
  total: number
  paidCash: number
  paidCredit: number
  /** Only known right after the sale; absent on reprints. */
  cashReceived?: number | null
  /** Customer's khata balance after this sale (only for credit customers). */
  khataBalance?: number | null
  voided: boolean
}

export function buildReceiptHtml(d: ReceiptData, paper: PaperWidth, lang: Lang): string {
  const L = labelsFor(lang)
  const out: string[] = []
  out.push(`<div class="c big">${esc(d.shopName)}</div>`)
  if (d.shopAddress) out.push(`<div class="c">${esc(d.shopAddress)}</div>`)
  if (d.shopPhone) out.push(`<div class="c">${esc(d.shopPhone)}</div>`)
  out.push('<hr>')
  out.push(row(L.invoice, d.invoiceNo, 'b'))
  out.push(row(L.date, d.createdAt))
  out.push(row(L.cashier, d.cashier))
  out.push(row(L.customer, d.customer ?? L.walkIn))
  if (d.voided) out.push(`<div class="void">${esc(L.voided)}</div>`)
  out.push('<hr>')
  for (const l of d.lines) {
    out.push(`<div class="line"><div class="item">${esc(l.name)}</div>`)
    out.push(row(`${l.qty} ${l.unit} x ${money(l.unitPrice)}`, money(l.total)))
    out.push('</div>')
  }
  out.push('<hr>')
  if (d.discount > 0) {
    out.push(row(L.subtotal, money(d.subtotal)))
    out.push(row(L.discount, `- ${money(d.discount)}`))
  }
  out.push(row(L.total, money(d.total), 'total'))
  out.push(row(L.paidCash, money(d.paidCash)))
  if (d.paidCredit > 0) out.push(row(L.onCredit, money(d.paidCredit)))
  if (d.cashReceived != null && d.cashReceived > d.paidCash) {
    out.push(row(L.cashReceived, money(d.cashReceived)))
    out.push(row(L.change, money(d.cashReceived - d.paidCash), 'b'))
  }
  if (d.khataBalance != null && d.paidCredit > 0) out.push(row(L.khataBalance, money(d.khataBalance), 'b'))
  out.push('<hr>')
  out.push(`<div class="c">${esc(d.footer || L.thanks)}</div>`)
  return htmlDocument(out.join('\n'), paper, lang)
}

export function buildTestPageHtml(
  shopName: string, printerName: string, paper: PaperWidth, lang: Lang, when: string
): string {
  const L = labelsFor(lang)
  const body = [
    `<div class="c big">${esc(shopName || 'Retail POS')}</div>`,
    `<div class="c b">${esc(L.testTitle)}</div>`,
    '<hr>',
    row(L.printer, printerName || '-'),
    row(L.paper, paper),
    row(L.date, when),
    '<hr>',
    `<div class="c">${esc(L.testOk)}</div>`,
    '<div class="c">0123456789 - Rs 1,234.50</div>'
  ].join('\n')
  return htmlDocument(body, paper, lang)
}
