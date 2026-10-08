import React, { useEffect, useState } from 'react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { HashRouter } from 'react-router-dom'
import { theme } from './theme'
import { AppRoutes } from './routes'
import { MigrationErrorScreen } from '../screens/MigrationErrorScreen'
import { ModulesProvider } from '../modules'
import { AuthProvider } from '../context/AuthContext'
import { changeAppLanguage } from '../i18n'

export const App: React.FC = () => {
  const [migrationError, setMigrationError] = useState<string | null>(null)
  const [checking, setChecking] = useState<boolean>(true)

  const initApp = async (): Promise<void> => {
    try {
      if (window.api?.db?.getMigrationStatus) {
        const res = await window.api.db.getMigrationStatus()
        if (res.ok && !res.data.success) {
          setMigrationError(res.data.error || 'Database initialization error')
        } else {
          setMigrationError(null)
        }
      }

      // Restore language from saved settings
      if (window.api?.settings?.get) {
        const langRes = await window.api.settings.get('language')
        if (langRes.ok && (langRes.data === 'ur' || langRes.data === 'en')) {
          changeAppLanguage(langRes.data)
        }
      }
    } catch (err) {
      setMigrationError((err as Error).message || 'Failed to initialize app')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    initApp()
  }, [])

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      {migrationError ? (
        <MigrationErrorScreen error={migrationError} onRetry={initApp} />
      ) : checking ? null : (
        <AuthProvider>
          <ModulesProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </ModulesProvider>
        </AuthProvider>
      )}
    </MantineProvider>
  )
}
