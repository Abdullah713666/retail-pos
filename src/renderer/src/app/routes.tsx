import React from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import { AppLayout } from './layout'
import { SaleScreen } from '../screens/SaleScreen'
import { ItemsScreen } from '../screens/ItemsScreen'
import { PartiesScreen } from '../screens/PartiesScreen'
import { PurchasesScreen } from '../screens/PurchasesScreen'
import { CashScreen } from '../screens/CashScreen'
import { ReportsScreen } from '../screens/ReportsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { SetupScreen } from '../screens/SetupScreen'
import { LoginScreen } from '../screens/LoginScreen'
import { MigrationErrorScreen } from '../screens/MigrationErrorScreen'
import { useModules } from '../modules'
import { useAuth } from '../context/AuthContext'

export const AppRoutes: React.FC = () => {
  const { activeUiModules } = useModules()
  const { user, hasUsers, loading } = useAuth()

  if (loading) {
    return null
  }

  const moduleRoutes = activeUiModules.flatMap((m) => m.routes)

  return (
    <Routes>
      {/* Wizard */}
      <Route
        path="/setup"
        element={hasUsers ? <Navigate to="/" replace /> : <SetupScreen />}
      />

      {/* Login */}
      <Route
        path="/login"
        element={
          !hasUsers ? (
            <Navigate to="/setup" replace />
          ) : user ? (
            <Navigate to="/" replace />
          ) : (
            <LoginScreen />
          )
        }
      />

      {/* Authenticated routes */}
      <Route
        path="/"
        element={
          !hasUsers ? (
            <Navigate to="/setup" replace />
          ) : !user ? (
            <Navigate to="/login" replace />
          ) : (
            <AppLayout />
          )
        }
      >
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
      </Route>

      <Route path="/migration-error" element={<MigrationErrorScreen />} />

      {/* Fallback */}
      <Route
        path="*"
        element={<Navigate to={!hasUsers ? '/setup' : !user ? '/login' : '/'} replace />}
      />
    </Routes>
  )
}
