import type React from 'react'
import type { Role } from '@shared/types'

export interface ModuleMenuItem {
  label: string
  path: string
  icon: React.ReactNode
  roles?: Role[]
}

export interface ModuleRoute {
  path: string
  element: React.ReactNode
}

export interface UiModule {
  id: string
  routes: ModuleRoute[]
  menu: ModuleMenuItem[]
  /** Extra block on the item form. `onChange` hands the block's data to the form, saved with the item in one transaction. */
  itemFormFields?: React.ComponentType<{ itemId?: number; onChange: (data: Record<string, unknown>) => void }>
  /** New items start with "track batches" ticked (pharmacy). */
  defaultTrackLots?: boolean
  /** Small info under a sale line (batch + expiry). */
  saleLineInfo?: React.ComponentType<{ itemId: number; qtyBase: number }>
  dashboardWidgets?: React.ComponentType[]
}
