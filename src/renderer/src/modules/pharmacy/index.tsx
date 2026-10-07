import React from 'react'
import { IconCalendarDue } from '@tabler/icons-react'
import type { UiModule } from '../types'
import { ExpiryScreen } from './ExpiryScreen'

export const pharmacyUiModule: UiModule = {
  id: 'pharmacy',
  routes: [
    {
      path: 'pharmacy/expiry',
      element: <ExpiryScreen />
    }
  ],
  menu: [
    {
      label: 'nav.expiry',
      path: '/pharmacy/expiry',
      icon: <IconCalendarDue size={20} stroke={1.5} />
    }
  ]
}
