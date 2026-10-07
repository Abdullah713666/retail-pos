import React from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './layout'
import { SaleScreen } from '../screens/SaleScreen'
import { ItemsScreen } from '../screens/ItemsScreen'
import { PartiesScreen } from '../screens/PartiesScreen'
import { PurchasesScreen } from '../screens/PurchasesScreen'
import { CashScreen } from '../screens/CashScreen'
import { ReportsScreen } from '../screens/ReportsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { SetupScreen } from '../screens/SetupScreen'
import { MigrationErrorScreen } from '../screens/MigrationErrorScreen'
import { useModules } from '../modules'

export const AppRoutes: React.FC = () => {
  const { activeUiModules } = useModules()

  const moduleRoutes = activeUiModules.flatMap((m) => m.routes)

  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<SaleScreen />} />
        <Route path="items" element={<ItemsScreen />} />
        <Route path="parties" element={<PartiesScreen />} />
        <Route path="purchases" element={<PurchasesScreen />} />
        <Route path="cash" element={<CashScreen />} />
        <Route path="reports" element={<ReportsScreen />} />
        {moduleRoutes.map((route) => {
          const path = route.path.startsWith('/') ? route.path.slice(1) : route.path
          return <Route key={path} path={path} element={route.element} />
        })}
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="setup" element={<SetupScreen />} />
      </Route>
      <Route path="/migration-error" element={<MigrationErrorScreen />} />
    </Routes>
  )
}
