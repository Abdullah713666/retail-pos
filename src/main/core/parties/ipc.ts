import { z } from 'zod'
import { ok, err, type Result } from '@shared/result'
import type { PartyType } from '@shared/types'
import { handleIpc } from '../../ipc/handle'
import { getDb } from '../../db/connection'
import { checkPermission, getCurrentUser } from '../auth/service'
import {
  getPartyById,
  listParties,
  createParty,
  updateParty,
  deactivateParty,
  reactivateParty
} from './service'
import { partyRoles, canSetPartyMoney, type PartyAction } from './permissions'

const typeSchema = z.enum(['customer', 'supplier'])
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const idSchema = z.number().int().positive()

const listSchema = z.object({
  type: typeSchema,
  query: z.string().max(100).optional(),
  activeOnly: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(200).optional()
})

const createSchema = z.object({
  type: typeSchema,
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(250).nullable().optional(),
  creditLimit: money.optional(),
  openingBalance: money.optional()
})

const updateSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(250).nullable().optional(),
  creditLimit: money.optional()
})

/** Checks the role for an action on an existing party (type comes from the DB, not the renderer). */
export function checkPartyAccess(partyId: number, action: PartyAction): Result<PartyType> {
  const party = getPartyById(getDb(), partyId)
  if (!party) return err({ code: 'PARTY_NOT_FOUND', message: 'Customer or supplier not found' })
  const perm = checkPermission(partyRoles(party.type, action))
  if (!perm.ok) return perm
  return ok(party.type)
}

export function registerPartiesIpc(): void {
  handleIpc('parties:list', listSchema, async (filter) => {
    const perm = checkPermission(partyRoles(filter.type, 'read'))
    if (!perm.ok) return perm
    return ok(listParties(getDb(), filter))
  })

  handleIpc('parties:get', idSchema, async (id) => {
    const access = checkPartyAccess(id, 'read')
    if (!access.ok) return access
    return ok(getPartyById(getDb(), id))
  })

  handleIpc('parties:create', createSchema, async (input) => {
    const perm = checkPermission(partyRoles(input.type, 'write'))
    if (!perm.ok) return perm
    const user = getCurrentUser()
    if (!user) return err({ code: 'UNAUTHORIZED', message: 'User must be logged in' })
    if (!canSetPartyMoney(user.role) && ((input.creditLimit ?? 0) > 0 || (input.openingBalance ?? 0) > 0)) {
      return err({ code: 'FORBIDDEN', message: 'Only a manager or owner can set credit limit or opening balance' })
    }
    return createParty(getDb(), input, user.id)
  })

  handleIpc('parties:update', updateSchema, async (input) => {
    const access = checkPartyAccess(input.id, 'write')
    if (!access.ok) return access
    const user = getCurrentUser()
    if (!user) return err({ code: 'UNAUTHORIZED', message: 'User must be logged in' })
    // Cashiers cannot change the credit limit: drop it so the stored value is kept.
    const safe = canSetPartyMoney(user.role) ? input : { ...input, creditLimit: undefined }
    return updateParty(getDb(), safe, user.id)
  })

  handleIpc('parties:deactivate', idSchema, async (id) => {
    const access = checkPartyAccess(id, 'deactivate')
    if (!access.ok) return access
    return deactivateParty(getDb(), id, getCurrentUser()?.id)
  })

  handleIpc('parties:reactivate', idSchema, async (id) => {
    const access = checkPartyAccess(id, 'deactivate')
    if (!access.ok) return access
    return reactivateParty(getDb(), id, getCurrentUser()?.id)
  })
}
