import { z } from 'zod'
import { ok } from '@shared/result'
import { handleIpc } from '../../ipc/handle'
import { getDb } from '../../db/connection'
import { checkPermission, getCurrentUser } from '../auth/service'
import { addCashEntry, closeShift, getOpenShift, getShiftDetail, listShifts, openShift } from './service'
import { getZReport } from './zreport'

const id = z.number().int().positive()
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const note = z.string().trim().max(250).nullable().optional()
const ALL = ['owner', 'manager', 'cashier'] as const

export function registerCashIpc(): void {
  handleIpc('cash:current', async () => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return ok(getOpenShift(getDb()))
  })

  handleIpc('cash:open', z.object({ openingCash: money }), async (input) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return openShift(getDb(), input, getCurrentUser()!.id)
  })

  handleIpc(
    'cash:addEntry',
    z.object({ shiftId: id, type: z.enum(['in', 'out', 'expense']), amount: money, note }),
    async (input) => {
      const perm = checkPermission([...ALL])
      if (!perm.ok) return perm
      return addCashEntry(getDb(), input, getCurrentUser()!.id)
    }
  )

  handleIpc('cash:close', z.object({ shiftId: id, countedCash: money, note }), async (input) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return closeShift(getDb(), input, getCurrentUser()!.id)
  })

  handleIpc('cash:detail', id, async (shiftId) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return getShiftDetail(getDb(), shiftId)
  })

  handleIpc('cash:list', z.number().int().positive().max(200).optional(), async (limit) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return ok(listShifts(getDb(), limit))
  })

  handleIpc('cash:zReport', id, async (shiftId) => {
    const perm = checkPermission([...ALL])
    if (!perm.ok) return perm
    return getZReport(getDb(), shiftId)
  })
}
