export type Role = 'owner' | 'manager' | 'cashier'

export interface User {
  id: number
  name: string
  username: string
  role: Role
  active: number
  createdAt: string
}

export interface CreateUserInput {
  name: string
  username: string
  pin: string
  role: Role
}

export interface LoginInput {
  userId: number
  pin: string
}

export interface SetupCompleteInput {
  shop: {
    name: string
    address?: string
    phone?: string
  }
  language?: 'en' | 'ur'
  paperWidth?: '58mm' | '80mm'
  printerName?: string
  receiptFooter?: string
  moduleIds: string[]
  owner: {
    name: string
    username: string
    pin: string
  }
}

export interface AppSettings {
  shop_name: string
  shop_address: string
  shop_phone: string
  receipt_footer: string
  printer_name: string
  paper_width: '58mm' | '80mm'
  language: 'en' | 'ur'
  business_type?: string
  wizard_completed: boolean
  enabled_modules: string[]
}
