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
  itemFormFields?: React.ComponentType<{ itemId?: number }>
  saleLineInfo?: React.ComponentType<{ line: unknown }>
  dashboardWidgets?: React.ComponentType[]
}
