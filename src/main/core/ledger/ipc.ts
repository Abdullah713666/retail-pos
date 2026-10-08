import { z } from 'zod'
import { handleIpc } from '../../ipc/handle'
import { getDb } from '../../db/connection'
import { getCurrentUser } from '../auth/service'
import { checkPartyAccess } from '../parties/ipc'
import { getStatement, recordPayment } from './service'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const statementSchema = z.object({
  partyId: z.number().int().positive(),
  from: dateSchema.optional(),
  to: dateSchema.optional()
})

const paymentSchema = z.object({
  partyId: z.number().int().positive(),
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  note: z.string().trim().max(250).nullable().optional()
})

/**
 * Only statement + payment are exposed to the renderer. Sales/purchases post
 * ledger entries from main-process services, never from the UI.
 */
export function registerLedgerIpc(): void {
  handleIpc('ledger:statement', statementSchema, async (input) => {
    const access = checkPartyAccess(input.partyId, 'read')
    if (!access.ok) return access
    return getStatement(getDb(), input)
  })

  handleIpc('ledger:recordPayment', paymentSchema, async (input) => {
    const access = checkPartyAccess(input.partyId, 'payment')
    if (!access.ok) return access
    return recordPayment(getDb(), input, getCurrentUser()?.id)
  })
}
