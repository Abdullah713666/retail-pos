import { z } from 'zod'
import { dialog, BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import { err, ok } from '@shared/result'
import { toCsv } from '@shared/csv'
import type { SaveCsvResult } from '@shared/types'
import { handleIpc } from '../../ipc/handle'
import { getDb } from '../../db/connection'
import { checkPermission } from '../auth/service'
import { getLowStock, getPayables, getReceivables, getSalesReport, getStockValue, isValidRange } from './service'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const range = z.object({ from: date, to: date })
const OWNER = ['owner' as const]

export function registerReportsIpc(): void {
  handleIpc('reports:sales', range.extend({ groupBy: z.enum(['day', 'item', 'user']) }), async (input) => {
    const perm = checkPermission(OWNER)
    if (!perm.ok) return perm
    if (!isValidRange(input)) return err({ code: 'INVALID_RANGE', message: 'The "from" date must not be after the "to" date' })
    return ok(getSalesReport(getDb(), input))
  })

  handleIpc('reports:stockValue', async () => {
    const perm = checkPermission(OWNER)
    return perm.ok ? ok(getStockValue(getDb())) : perm
  })
  handleIpc('reports:lowStock', async () => {
    const perm = checkPermission(OWNER)
    return perm.ok ? ok(getLowStock(getDb())) : perm
  })
  handleIpc('reports:receivables', async () => {
    const perm = checkPermission(OWNER)
    return perm.ok ? ok(getReceivables(getDb())) : perm
  })
  handleIpc('reports:payables', async () => {
    const perm = checkPermission(OWNER)
    return perm.ok ? ok(getPayables(getDb())) : perm
  })

  // The renderer sends the table it is showing; the save dialog and file write stay in the main process.
  handleIpc(
    'reports:saveCsv',
    z.object({
      suggestedName: z.string().trim().min(1).max(100),
      rows: z.array(z.array(z.union([z.string().max(1000), z.number()])).max(30)).max(100_000)
    }),
    async (input) => {
      const perm = checkPermission(OWNER)
      if (!perm.ok) return perm
      const safeName = input.suggestedName.replace(/[^\w.-]+/g, '_').replace(/\.csv$/i, '')
      const options = {
        defaultPath: `${safeName}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      }
      const win = BrowserWindow.getFocusedWindow()
      const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
      if (res.canceled || !res.filePath) return ok<SaveCsvResult>({ saved: false, path: null })
      try {
        writeFileSync(res.filePath, toCsv(input.rows), 'utf8')
      } catch (e) {
        return err({ code: 'WRITE_FAILED', message: `Could not save the file: ${(e as Error).message}` })
      }
      return ok<SaveCsvResult>({ saved: true, path: res.filePath })
    }
  )
}
