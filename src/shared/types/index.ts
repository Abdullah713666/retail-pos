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

// Categories
export interface Category {
  id: number
  name: string
  active: number
}

// Items & Units
export interface ItemUnit {
  id: number
  itemId: number
  name: string
  factor: number
  barcode: string | null
  salePrice: number | null // in paisa
}

export interface Item {
  id: number
  name: string
  searchText: string
  barcode: string | null
  categoryId: number | null
  categoryName?: string | null
  baseUnit: string
  salePrice: number // in paisa
  costPrice: number // in paisa
  reorderLevel: number
  trackStock: number
  trackLots: number
  stockCache: number
  active: number
  createdAt: string
  updatedAt: string
  units: ItemUnit[]
}

export interface CreateItemUnitInput {
  name: string
  factor: number
  barcode?: string | null
  salePrice?: number | null // in paisa
}

export interface CreateItemInput {
  name: string
  aliases?: string
  barcode?: string | null
  categoryId?: number | null
  baseUnit: string
  salePrice: number // in paisa
  costPrice: number // in paisa
  reorderLevel?: number
  trackStock?: boolean
  trackLots?: boolean
  units?: CreateItemUnitInput[]
  openingStock?: {
    qty: number // in base units
  }
}

export interface UpdateItemInput {
  id: number
  name: string
  aliases?: string
  barcode?: string | null
  categoryId?: number | null
  baseUnit: string
  salePrice: number // in paisa
  costPrice: number // in paisa
  reorderLevel?: number
  trackStock?: boolean
  trackLots?: boolean
  units?: CreateItemUnitInput[]
}

export interface ItemFilter {
  query?: string
  categoryId?: number | null
  activeOnly?: boolean
  page?: number
  pageSize?: number
}

export interface ItemListResult {
  items: Item[]
  total: number
  page: number
  pageSize: number
}

export interface BarcodeLookupResult {
  item: Item
  unit?: ItemUnit | null
}

// CSV Import
export interface CsvPreviewRow {
  rowNumber: number
  name: string
  barcode?: string | null
  category?: string | null
  baseUnit: string
  salePrice: number // in paisa
  costPrice: number // in paisa
  packName?: string | null
  packFactor?: number | null
}

export interface CsvImportError {
  rowNumber: number
  field?: string
  message: string
  rawData: Record<string, string>
}

export interface CsvPreviewResult {
  totalRows: number
  validRows: CsvPreviewRow[]
  errors: CsvImportError[]
}

export interface CsvImportResult {
  importedCount: number
  skippedCount: number
}
export * from './parties'
export * from './purchases'
