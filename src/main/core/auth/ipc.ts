import { z } from 'zod'
import { ok } from '@shared/result'
import { handleIpc } from '../../ipc/handle'
import { getDb } from '../../db/connection'
import { checkPermission } from './service'
import { changeOwnPin, resetUserPin, regenerateRecoveryCode } from './pin'
import { hasRecoveryCode, recoverOwnerPin } from './recovery'

const pinSchema = z.string().regex(/^\d{4,6}$/)

export function registerPinIpc(): void {
  handleIpc(
    'users:changeOwnPin',
    z.object({ currentPin: pinSchema, newPin: pinSchema }),
    async (input) => changeOwnPin(getDb(), input)
  )

  handleIpc(
    'users:resetPin',
    z.object({ userId: z.number().int().positive(), newPin: pinSchema }),
    async (input) => resetUserPin(getDb(), input)
  )

  // Only says whether a code exists. Never the code or its hash.
  handleIpc('recovery:status', async () => {
    const db = getDb()
    const perm = checkPermission(db, ['owner'])
    if (!perm.ok) return perm
    return ok({ hasCode: hasRecoveryCode(db) })
  })

  handleIpc('recovery:regenerate', z.object({ pin: pinSchema }), async (input) =>
    regenerateRecoveryCode(getDb(), input)
  )

  // Used from the login screen, so no session is required.
  handleIpc(
    'auth:recoverOwnerPin',
    z.object({ code: z.string().min(8).max(40), newPin: pinSchema }),
    async (input) => recoverOwnerPin(getDb(), input)
  )
}
