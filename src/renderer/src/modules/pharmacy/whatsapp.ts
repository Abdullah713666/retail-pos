import type { ExpiryRow, WantBookEntry } from '@shared/types'

export interface WhatsappLabels {
  title: string
  noSupplier: string
  batch: string
  expires: string
  qty: string
}

function groupBy<T>(rows: T[], key: (r: T) => string | null, none: string): Array<[string, T[]]> {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const k = key(r) ?? none
    map.set(k, [...(map.get(k) ?? []), r])
  }
  // suppliers A-Z, the "no supplier" group last
  return [...map.entries()].sort(([a], [b]) => (a === none ? 1 : b === none ? -1 : a.localeCompare(b)))
}

/** Plain text for WhatsApp: *bold* headings, one line per batch. */
export function expiryWhatsappText(rows: ExpiryRow[], l: WhatsappLabels): string {
  const out: string[] = [`*${l.title}*`]
  for (const [supplier, items] of groupBy(rows, (r) => r.supplierName, l.noSupplier)) {
    out.push('', `*${supplier}*`)
    for (const r of items) {
      out.push(`- ${r.itemName} | ${l.batch} ${r.lotNo} | ${l.expires} ${r.expiryDate} | ${l.qty} ${r.qtyBase} ${r.unit}`)
    }
  }
  return out.join('\n')
}

/** Plain text for WhatsApp: one *supplier* block per supplier, one line per medicine. */
export function wantBookWhatsappText(entries: WantBookEntry[], l: Pick<WhatsappLabels, 'title' | 'noSupplier'>): string {
  const out: string[] = [`*${l.title}*`]
  for (const [supplier, items] of groupBy(entries, (e) => e.supplierName, l.noSupplier)) {
    out.push('', `*${supplier}*`)
    for (const e of items) out.push(`- ${e.itemName} x ${e.qty}`)
  }
  return out.join('\n')
}
