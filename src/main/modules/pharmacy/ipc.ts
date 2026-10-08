import { z } from 'zod'
import { ok } from '@shared/result'
import { handleIpc } from '../../ipc/handle'
import { getDb } from '../../db/connection'
import { checkPermission } from '../../core/auth/service'
import type { PharmacyDashboard } from '@shared/types'
import { getItemInfo } from './info'
import { previewAllocation } from './fefo'
import { expirySummary, listExpiry } from './expiry'
import { addManual, countOpen, listWantBook, setStatus } from './wantbook'

const id = z.number().int().positive()
const ALL = ['owner', 'manager', 'cashier'] as const

export function registerPharmacyIpc(): void {
  handleIpc('pharmacy:getItemInfo', id, async (itemId) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return ok(getItemInfo(getDb(), itemId))
  })

  handleIpc(
    'pharmacy:previewAllocation',
    z.object({ itemId: id, qtyBase: z.number().int().positive().max(1_000_000_000) }),
    async ({ itemId, qtyBase }) => {
      const perm = checkPermission([...ALL])
      if (!perm.ok) return perm
      return ok(previewAllocation(getDb(), itemId, qtyBase))
    }
  )

  handleIpc(
    'pharmacy:listExpiry',
    z.object({ range: z.union([z.literal('expired'), z.literal(30), z.literal(60), z.literal(90)]), supplierId: id.nullable().optional() }),
    async (filter) => {
      const perm = checkPermission([...ALL])
      if (!perm.ok) return perm
      return ok(listExpiry(getDb(), filter))
    }
  )

  handleIpc('pharmacy:wantBook:list', z.enum(['active', 'open', 'ordered', 'done']), async (status) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return ok(listWantBook(getDb(), status))
  })

  handleIpc(
    'pharmacy:wantBook:add',
    z.object({
      itemId: id.nullable().optional(),
      freeText: z.string().trim().max(120).nullable().optional(),
      qty: z.number().int().positive().max(1_000_000),
      supplierId: id.nullable().optional()
    }),
    async (input) => {
      const perm = checkPermission([...ALL])
      if (!perm.ok) return perm
      return addManual(getDb(), input)
    }
  )

  handleIpc('pharmacy:wantBook:setStatus', z.object({ id, status: z.enum(['open', 'ordered', 'done']) }), async (input) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return setStatus(getDb(), input.id, input.status)
  })

  handleIpc('pharmacy:dashboard', async () => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    const db = getDb()
    const s = expirySummary(db)
    const out: PharmacyDashboard = { expired: s.expired, within30: s.within30, wantBookOpen: countOpen(db) }
    return ok(out)
  })
}
