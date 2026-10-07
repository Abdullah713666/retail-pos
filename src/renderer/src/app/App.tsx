import React from 'react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { HashRouter } from 'react-router-dom'
import { theme } from './theme'
import { AppRoutes } from './routes'

export const App: React.FC = () => {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </MantineProvider>
  )
}
