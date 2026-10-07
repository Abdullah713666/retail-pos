import React, { useEffect, useState } from 'react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { HashRouter } from 'react-router-dom'
import { theme } from './theme'
import { AppRoutes } from './routes'
import { MigrationErrorScreen } from '../screens/MigrationErrorScreen'
import { ModulesProvider } from '../modules'

export const App: React.FC = () => {
  const [migrationError, setMigrationError] = useState<string | null>(null)
  const [checking, setChecking] = useState<boolean>(true)

  const checkMigration = async (): Promise<void> => {
    try {
      if (window.api?.db?.getMigrationStatus) {
        const res = await window.api.db.getMigrationStatus()
        if (res.ok && !res.data.success) {
          setMigrationError(res.data.error || 'Database initialization error')
        } else {
          setMigrationError(null)
        }
      }
    } catch (err) {
      setMigrationError((err as Error).message || 'Failed to check migration status')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    checkMigration()
  }, [])

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      {migrationError ? (
        <MigrationErrorScreen error={migrationError} onRetry={checkMigration} />
      ) : checking ? null : (
        <ModulesProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </ModulesProvider>
      )}
    </MantineProvider>
  )
}
