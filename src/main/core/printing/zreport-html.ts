/** Z report -> thermal HTML. Pure. */
import type { PaperWidth, ZReport } from '@shared/types'
import { esc, htmlDocument, money, row } from './html'
import { labelsFor, type Lang } from './labels'

export function buildZReportHtml(z: ZReport, shopName: string, paper: PaperWidth, lang: Lang): string {
  const L = labelsFor(lang)
  const { shift, cash } = z
  const out: string[] = []
  out.push(`<div class="c big">${esc(shopName)}</div>`)
  out.push(`<div class="c b">${esc(L.zTitle)}</div>`)
  if (!shift.closedAt) out.push(`<div class="c">${esc(L.zOpen)}</div>`)
  out.push('<hr>')
  out.push(row(L.shift, `#${shift.id}`, 'b'))
  out.push(row(L.openedBy, shift.userName))
  out.push(row(L.opened, shift.openedAt))
  out.push(row(L.closed, shift.closedAt ?? '-'))
  out.push(`<div class="sec">${esc(L.sales)}</div>`)
  out.push(row(L.invoices, String(z.sales.count)))
  out.push(row(L.grossSales, money(z.sales.subtotal)))
  out.push(row(L.discounts, `- ${money(z.sales.discount)}`))
  out.push(row(L.netSales, money(z.sales.total), 'b'))
  out.push(`<div class="sec">${esc(L.byPayment)}</div>`)
  out.push(row(L.cash, money(z.byPayment.cash)))
  out.push(row(L.credit, money(z.byPayment.credit)))
  out.push(`<div class="sec">${esc(L.returns)}</div>`)
  out.push(row(`${L.returns} (${z.returns.count})`, money(z.returns.total)))
  out.push(row(L.returnsCash, money(z.returns.cash)))
  out.push(row(L.voids, `${z.voids.count} / ${money(z.voids.total)}`))
  out.push('<hr>')
  out.push(`<div class="sec">${esc(L.cashDrawer)}</div>`)
  out.push(row(L.opening, money(cash.openingCash)))
  out.push(row(`+ ${L.cashSales}`, money(cash.cashSales)))
  out.push(row(`- ${L.cashRefunds}`, money(cash.cashRefunds)))
  out.push(row(`+ ${L.cashIn}`, money(cash.cashIn)))
  out.push(row(`- ${L.cashOut}`, money(cash.cashOut)))
  out.push(row(`- ${L.expenses}`, money(cash.expenses)))
  out.push(row(`- ${L.supplierPaid}`, money(cash.supplierPaid)))
  out.push(row(`+ ${L.customerPaid}`, money(cash.customerPaid)))
  out.push(row(L.expected, money(cash.expectedCash), 'total'))
  if (shift.countedCash != null) {
    out.push(row(L.counted, money(shift.countedCash), 'b'))
    out.push(row(L.difference, money(shift.difference ?? 0), 'total'))
  }
  if (z.entries.length > 0) {
    out.push(`<hr><div class="sec">${esc(L.entries)}</div>`)
    for (const e of z.entries) {
      const sign = e.type === 'in' ? '+' : '-'
      out.push(row(`${sign} ${e.type === 'in' ? L.cashIn : e.type === 'out' ? L.cashOut : L.expenses}${e.note ? `: ${e.note}` : ''}`, money(e.amount)))
    }
  }
  if (shift.note) out.push(`<hr><div>${esc(L.noteLabel)}: ${esc(shift.note)}</div>`)
  out.push('<hr>', `<div class="c">${esc(z.generatedAt)}</div>`, `<br><div>${esc(L.signature)}: ______________</div>`)
  return htmlDocument(out.join('\n'), paper, lang)
}
