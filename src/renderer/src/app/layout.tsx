import React from 'react'
import { AppShell, NavLink, Group, Title, Text, Stack } from '@mantine/core'
import {
  IconShoppingCart,
  IconPackage,
  IconUsers,
  IconTruckDelivery,
  IconCash,
  IconReportAnalytics,
  IconSettings
} from '@tabler/icons-react'
import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useModules } from '../modules'

export const AppLayout: React.FC = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { activeUiModules } = useModules()

  const coreNavItems = [
    { label: t('nav.sale'), path: '/', icon: <IconShoppingCart size={20} stroke={1.5} /> },
    { label: t('nav.items'), path: '/items', icon: <IconPackage size={20} stroke={1.5} /> },
    { label: t('nav.parties'), path: '/parties', icon: <IconUsers size={20} stroke={1.5} /> },
    { label: t('nav.purchases'), path: '/purchases', icon: <IconTruckDelivery size={20} stroke={1.5} /> },
    { label: t('nav.cash'), path: '/cash', icon: <IconCash size={20} stroke={1.5} /> },
    { label: t('nav.reports'), path: '/reports', icon: <IconReportAnalytics size={20} stroke={1.5} /> }
  ]

  const moduleNavItems = activeUiModules.flatMap((mod) =>
    mod.menu.map((item) => ({
      label: t(item.label),
      path: item.path,
      icon: item.icon
    }))
  )

  const settingsNavItem = {
    label: t('nav.settings'),
    path: '/settings',
    icon: <IconSettings size={20} stroke={1.5} />
  }

  const navItems = [...coreNavItems, ...moduleNavItems, settingsNavItem]

  const [version, setVersion] = React.useState<string>('')

  React.useEffect(() => {
    window.api?.app.getVersion().then((res) => {
      if (res.ok) {
        setVersion(`v${res.data}`)
      }
    })
  }, [])

  return (
    <AppShell navbar={{ width: 220, breakpoint: 'sm' }} padding="md">
      <AppShell.Navbar p="xs">
        <Group
          mb="md"
          px="xs"
          py="xs"
          style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
        >
          <div>
            <Title order={4} c="blue">
              {t('app.title')}
            </Title>
            {version && (
              <Text size="xs" c="dimmed">
                {version}
              </Text>
            )}
          </div>
        </Group>
        <Stack gap="xs">
          {navItems.map((item) => {
            const active = location.pathname === item.path
            return (
              <NavLink
                key={item.path}
                label={item.label}
                leftSection={item.icon}
                active={active}
                onClick={() => navigate(item.path)}
                variant="light"
                style={{ borderRadius: 6 }}
              />
            )
          })}
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
