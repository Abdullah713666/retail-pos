import { z } from 'zod'
import { err } from '@shared/result'
import { handleIpc } from '../../ipc/handle'
import { getDb } from '../../db/connection'
import { checkPermission, getCurrentUser } from '../auth/service'
import { createPurchase, getPurchase, listPurchases, returnPurchase } from './service'

const id = z.number().int().positive()
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const lineSchema = z.object({
  itemId: id,
  unitName: z.string().trim().max(60).nullable().optional(),
  qty: z.number().int().positive().max(1_000_000_000),
  unitCost: money,
  lotNo: z.string().trim().max(60).nullable().optional(),
  expiryDate: date.nullable().optional()
})

const createSchema = z.object({
  supplierId: id,
  billNo: z.string().trim().max(60).nullable().optional(),
  date: date.nullable().optional(),
  lines: z.array(lineSchema).min(1).max(500),
  discount: money.optional(),
  paid: money.optional(),
  note: z.string().trim().max(250).nullable().optional()
})

const listSchema = z.object({
  supplierId: id.optional(),
  from: date.optional(),
  to: date.optional(),
  query: z.string().max(100).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(200).optional()
})

const returnSchema = z.object({
  purchaseId: id,
  lines: z
    .array(z.object({ purchaseLineId: id, qtyBase: z.number().int().positive().max(1_000_000_000) }))
    .min(1)
    .max(500),
  note: z.string().trim().max(250).nullable().optional()
})

const ROLES: Array<'manager' | 'owner'> = ['manager', 'owner']

export function registerPurchasesIpc(): void {
  handleIpc('purchases:list', listSchema, async (filter) => {
    const perm = checkPermission(ROLES)
    if (!perm.ok) return perm
    return { ok: true, data: listPurchases(getDb(), filter) }
  })

  handleIpc('purchases:get', id, async (purchaseId) => {
    const perm = checkPermission(ROLES)
    if (!perm.ok) return perm
    const purchase = getPurchase(getDb(), purchaseId)
    if (!purchase) return err({ code: 'NOT_FOUND', message: 'Purchase not found' })
    return { ok: true, data: purchase }
  })

  handleIpc('purchases:create', createSchema, async (input) => {
    const perm = checkPermission(ROLES)
    if (!perm.ok) return perm
    return createPurchase(getDb(), input, getCurrentUser()!.id)
  })

  handleIpc('purchases:return', returnSchema, async (input) => {
    const perm = checkPermission(ROLES)
    if (!perm.ok) return perm
    return returnPurchase(getDb(), input, getCurrentUser()!.id)
  })
}
