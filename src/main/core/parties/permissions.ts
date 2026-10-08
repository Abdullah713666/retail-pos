import type { PartyType, Role } from '@shared/types'

export type PartyAction = 'read' | 'write' | 'payment' | 'deactivate'

const ALL: Role[] = ['cashier', 'manager', 'owner']
const MANAGERS: Role[] = ['manager', 'owner']

/**
 * Who may do what. Cashiers handle customers (create, look up, take payments) but never
 * touch suppliers, and cannot set credit limits / opening balances or deactivate accounts.
 */
export function partyRoles(type: PartyType, action: PartyAction): Role[] {
  if (type === 'supplier') return MANAGERS
  return action === 'deactivate' ? MANAGERS : ALL
}

/** Credit limit and opening balance are money controls: manager/owner only. */
export function canSetPartyMoney(role: Role): boolean {
  return role !== 'cashier'
}
