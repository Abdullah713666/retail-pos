export type Role = 'owner' | 'manager' | 'cashier'

export interface User {
  id: number
  name: string
  username: string
  role: Role
  active: number
  createdAt: string
}
