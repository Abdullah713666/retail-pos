import { z } from 'zod'
import { handleIpc } from '../../ipc/handle'
import { getDb } from '../../db/connection'
import { checkPermission } from '../auth/service'
import { listPrinters, printSale, printZReport, testPrint } from './service'

const ALL = ['owner', 'manager', 'cashier'] as const

export function registerPrintingIpc(): void {
  // Listing and test print are also used by the first-run wizard, before any user exists.
  handleIpc('printing:listPrinters', async () => listPrinters())

  handleIpc(
    'printing:testPrint',
    z.object({ printerName: z.string().trim().max(200), paperWidth: z.enum(['58mm', '80mm']) }),
    async (input) => testPrint(getDb(), input)
  )

  handleIpc(
    'printing:printSale',
    z.object({ saleId: z.number().int().positive(), cashReceived: z.number().int().nonnegative().optional() }),
    async (input) => {
      const perm = checkPermission([...ALL])
      if (!perm.ok) return perm
      return printSale(getDb(), input.saleId, input.cashReceived)
    }
  )

  handleIpc('printing:printZReport', z.number().int().positive(), async (shiftId) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return printZReport(getDb(), shiftId)
  })
}
