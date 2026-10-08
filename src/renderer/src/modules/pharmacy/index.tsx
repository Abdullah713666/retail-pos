import { IconCalendarDue, IconNotebook } from '@tabler/icons-react'
import type { UiModule } from '../types'
import { ExpiryScreen } from './ExpiryScreen'
import { WantBookScreen } from './WantBookScreen'
import { ItemFields } from './ItemFields'
import { SaleLineInfo } from './SaleLineInfo'
import { PharmacyDashboardWidget } from './DashboardWidget'

export const pharmacyUiModule: UiModule = {
  id: 'pharmacy',
  routes: [
    { path: 'pharmacy/expiry', element: <ExpiryScreen /> },
    { path: 'pharmacy/want-book', element: <WantBookScreen /> }
  ],
  menu: [
    { label: 'nav.expiry', path: '/pharmacy/expiry', icon: <IconCalendarDue size={20} stroke={1.5} /> },
    { label: 'nav.wantBook', path: '/pharmacy/want-book', icon: <IconNotebook size={20} stroke={1.5} /> }
  ],
  itemFormFields: ItemFields,
  defaultTrackLots: true,
  saleLineInfo: SaleLineInfo,
  dashboardWidgets: [PharmacyDashboardWidget]
}
