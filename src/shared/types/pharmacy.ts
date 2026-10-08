export type PharmacySchedule = 'otc' | 'rx' | 'controlled'

export interface PharmacyItemInfo {
  genericName: string
  manufacturer: string
  strength: string
  form: string
  schedule: PharmacySchedule | null
  rack: string
}

export type ExpiryRange = 'expired' | 30 | 60 | 90

export interface ExpiryFilter {
  range: ExpiryRange
  supplierId?: number | null
}

export interface ExpiryRow {
  lotId: number
  itemId: number
  itemName: string
  unit: string
  lotNo: string
  expiryDate: string
  daysLeft: number // negative = already expired
  qtyBase: number
  supplierId: number | null
  supplierName: string | null
}

export interface ExpirySummary {
  expired: number
  within30: number
  within60: number
  within90: number
}

export interface LotPreviewChunk {
  lotId: number
  lotNo: string
  expiryDate: string | null
  qtyBase: number
  expired: boolean
}

export interface AllocationPreview {
  tracked: boolean // false = item has no batches
  chunks: LotPreviewChunk[]
  /** Only expired stock can cover this line: the owner must approve at payment. */
  needsOverride: boolean
  shortBase: number
}

export type WantStatus = 'open' | 'ordered' | 'done'

export interface WantBookEntry {
  id: number
  itemId: number | null
  itemName: string
  qty: number
  supplierId: number | null
  supplierName: string | null
  source: 'auto' | 'manual'
  status: WantStatus
  createdAt: string
}

export interface WantBookAddInput {
  itemId?: number | null
  freeText?: string | null
  qty: number
  supplierId?: number | null
}

export interface PharmacyDashboard {
  expired: number
  within30: number
  wantBookOpen: number
}
