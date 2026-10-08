/**
 * Silent thermal printing. The HTML (built by the pure functions in receipt.ts / zreport-html.ts)
 * is rendered in a hidden BrowserWindow and sent with webContents.print to the chosen printer.
 *
 * Printing is ALWAYS a separate step after the sale is saved. Every function here returns a
 * Result and never throws, so a printer problem can never break or undo a sale.
 */
import { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import { err, ok, type Result } from '@shared/result'
import { nowLocal } from '@shared/dates'
import type { PaperWidth, PrinterInfo, TestPrintInput } from '@shared/types'
import { getAllSettings } from '../settings/service'
import { getZReport } from '../cash/zreport'
import { paperMicrons } from './html'
import type { Lang } from './labels'
import { buildReceiptHtml, buildTestPageHtml } from './receipt'
import { loadReceiptData } from './receipt-data'
import { buildZReportHtml } from './zreport-html'

const PRINT_TIMEOUT_MS = 30_000
const PX_TO_MICRONS = 264.5833

function failure(message: string): Result<never> {
  return err({ code: 'PRINT_FAILED', message })
}

export async function listPrinters(): Promise<Result<PrinterInfo[]>> {
  try {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return ok([])
    const list = await win.webContents.getPrintersAsync()
    return ok(list.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: (p as { isDefault?: boolean }).isDefault === true })))
  } catch (e) {
    return failure(`Could not list printers: ${(e as Error).message}`)
  }
}

/** Renders html in a hidden window and prints it silently. Never throws. */
export async function printHtml(html: string, printerName: string, paper: PaperWidth): Promise<Result<void>> {
  if (!printerName.trim()) {
    return failure('No printer chosen. Go to Settings > Printer, pick your printer, then press F9 to print again.')
  }
  let win: BrowserWindow | null = null
  try {
    win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, javascript: false } })
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const wc = win.webContents
    // Roll paper has no fixed length: measure the content so the printer cuts in the right place.
    const heightPx = (await wc.executeJavaScript('document.documentElement.scrollHeight')) as number
    const height = Math.max(Math.ceil((Number(heightPx) || 400) * PX_TO_MICRONS) + 5000, 60000)

    const result = await new Promise<Result<void>>((resolve) => {
      const timer = setTimeout(
        () => resolve(failure('The printer did not respond. Check it is on and has paper, then press F9 to print again.')),
        PRINT_TIMEOUT_MS
      )
      wc.print(
        {
          silent: true,
          deviceName: printerName,
          printBackground: false,
          margins: { marginType: 'none' },
          pageSize: { width: paperMicrons(paper), height }
        },
        (success, reason) => {
          clearTimeout(timer)
          resolve(
            success
              ? ok(undefined)
              : failure(`Printer error${reason ? ` (${reason})` : ''}. Check it is on and connected, then press F9 to print again.`)
          )
        }
      )
    })
    return result
  } catch (e) {
    return failure(`Printer error: ${(e as Error).message}. Check it is on, then press F9 to print again.`)
  } finally {
    try {
      win?.destroy()
    } catch {
      /* window already gone */
    }
  }
}

function printSettings(db: Database.Database): { printer: string; paper: PaperWidth; lang: Lang; shop: string } {
  const s = getAllSettings(db)
  return {
    printer: s['printer_name'] || '',
    paper: s['paper_width'] === '58mm' ? '58mm' : '80mm',
    lang: s['language'] === 'ur' ? 'ur' : 'en',
    shop: s['shop_name'] || ''
  }
}

export async function printSale(db: Database.Database, saleId: number, cashReceived?: number): Promise<Result<void>> {
  try {
    const { printer, paper, lang } = printSettings(db)
    const data = loadReceiptData(db, saleId, cashReceived)
    if (!data.ok) return data
    return await printHtml(buildReceiptHtml(data.data, paper, lang), printer, paper)
  } catch (e) {
    return failure(`Could not print: ${(e as Error).message}`)
  }
}

export async function printZReport(db: Database.Database, shiftId: number): Promise<Result<void>> {
  try {
    const { printer, paper, lang, shop } = printSettings(db)
    const z = getZReport(db, shiftId)
    if (!z.ok) return z
    return await printHtml(buildZReportHtml(z.data, shop, paper, lang), printer, paper)
  } catch (e) {
    return failure(`Could not print: ${(e as Error).message}`)
  }
}

/** Uses the printer/paper from the form (not yet saved), so the owner can test before saving. */
export async function testPrint(db: Database.Database, input: TestPrintInput): Promise<Result<void>> {
  try {
    const { lang, shop } = printSettings(db)
    return await printHtml(buildTestPageHtml(shop, input.printerName, input.paperWidth, lang, nowLocal()), input.printerName, input.paperWidth)
  } catch (e) {
    return failure(`Could not print: ${(e as Error).message}`)
  }
}
