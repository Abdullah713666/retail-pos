import { z } from 'zod'
import { err, ok } from '@shared/result'
import { handleIpc } from '../../ipc/handle'
import { getDb } from '../../db/connection'
import { checkPermission, getCurrentUser } from '../auth/service'
import {
  completeSale, discardHeld, getSale, getSaleByInvoice, holdSale, listSales, returnSale, voidSale
} from './service'

const id = z.number().int().positive()
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const bp = z.number().int().min(0).max(10000)

const lineSchema = z.object({
  itemId: id,
  unitId: id.nullable().optional(),
  qty: z.number().int().positive().max(1_000_000_000),
  discount: money.optional(),
  discountBp: bp.nullable().optional()
})

const draftShape = {
  partyId: id.nullable().optional(),
  lines: z.array(lineSchema).min(1).max(500),
  billDiscount: money.optional(),
  billDiscountBp: bp.nullable().optional(),
  note: z.string().trim().max(250).nullable().optional(),
  heldSaleId: id.nullable().optional()
}
const draftSchema = z.object(draftShape)
const approval = z.object({ userId: id, pin: z.string().regex(/^\d{4,6}$/) })
const completeSchema = z.object({
  ...draftShape,
  paidCash: money,
  paidCredit: money,
  overrideApproval: approval.nullable().optional()
})

const returnSchema = z.object({
  saleId: id,
  lines: z.array(z.object({ saleLineId: id, qtyBase: z.number().int().positive().max(1_000_000_000) })).min(1).max(500),
  refundTo: z.enum(['auto', 'cash', 'credit']).optional(),
  note: z.string().trim().max(250).nullable().optional(),
  approval: approval.nullable().optional()
})

const voidSchema = z.object({ saleId: id, reason: z.string().trim().min(1).max(250), approval })

const listSchema = z.object({
  status: z.enum(['held', 'completed', 'void']).optional(),
  query: z.string().max(100).optional(),
  limit: z.number().int().positive().max(200).optional()
})

const ALL = ['owner', 'manager', 'cashier'] as const

export function registerSalesIpc(): void {
  handleIpc('sales:complete', completeSchema, async (input) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return completeSale(getDb(), input, getCurrentUser()!.id)
  })

  handleIpc('sales:hold', draftSchema, async (input) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return holdSale(getDb(), input, getCurrentUser()!.id)
  })

  handleIpc('sales:discardHeld', id, async (saleId) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return discardHeld(getDb(), saleId, getCurrentUser()!.id)
  })

  handleIpc('sales:list', listSchema, async (filter) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return ok(listSales(getDb(), filter))
  })

  handleIpc('sales:get', id, async (saleId) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    const sale = getSale(getDb(), saleId)
    return sale ? ok(sale) : err({ code: 'NOT_FOUND', message: 'Sale not found' })
  })

  handleIpc('sales:getByInvoice', z.string().trim().min(1).max(40), async (invoiceNo) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    const sale = getSaleByInvoice(getDb(), invoiceNo)
    return sale ? ok(sale) : err({ code: 'NOT_FOUND', message: 'No sale with that invoice number' })
  })

  handleIpc('sales:return', returnSchema, async (input) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return returnSale(getDb(), input, getCurrentUser()!)
  })

  handleIpc('sales:void', voidSchema, async (input) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return voidSale(getDb(), input, getCurrentUser()!.id)
  })
}
