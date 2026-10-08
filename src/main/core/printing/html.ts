/** Shared HTML helpers for thermal paper. Pure: no electron, no db. */
import { formatPKR } from '@shared/money'
import type { PaperWidth } from '@shared/types'
import type { Lang } from './labels'

export function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  )
}

/** Printable width in mm (paper minus the thermal head's dead margins). */
export function contentMm(paper: PaperWidth): number {
  return paper === '58mm' ? 48 : 72
}

/** Paper width in microns, as webContents.print({ pageSize }) wants. */
export function paperMicrons(paper: PaperWidth): number {
  return paper === '58mm' ? 58000 : 80000
}

export function money(paisa: number): string {
  return formatPKR(paisa)
}

export function row(label: string, value: string, cls = ''): string {
  return `<div class="r ${cls}"><span>${esc(label)}</span><span class="n">${esc(value)}</span></div>`
}

/** Wraps body HTML in a full document sized for the paper. Urdu gets dir=rtl. */
export function htmlDocument(body: string, paper: PaperWidth, lang: Lang): string {
  const w = contentMm(paper)
  const small = paper === '58mm'
  return `<!doctype html>
<html lang="${lang}" dir="${lang === 'ur' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 2mm 0; width: ${w}mm; color: #000; background: #fff;
    font-family: 'Segoe UI', Tahoma, 'Noto Sans Arabic', 'Noto Nastaliq Urdu', Arial, sans-serif;
    font-size: ${small ? 11 : 13}px; line-height: 1.35; }
  .c { text-align: center; } .b { font-weight: 700; } .big { font-size: ${small ? 15 : 18}px; font-weight: 700; }
  .r { display: flex; justify-content: space-between; gap: 6px; }
  .n { direction: ltr; unicode-bidi: isolate; white-space: nowrap; }
  .line { margin: 3px 0; } .item { font-weight: 600; }
  hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
  .total { font-size: ${small ? 14 : 16}px; font-weight: 800; }
  .void { text-align: center; font-weight: 800; font-size: 16px; margin: 4px 0; }
  .sec { font-weight: 700; margin-top: 6px; }
</style></head><body>${body}</body></html>`
}
