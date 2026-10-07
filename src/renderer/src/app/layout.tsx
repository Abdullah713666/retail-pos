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

export const AppLayout: React.FC = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const navItems = [
    { label: t('nav.sale'), path: '/', icon: IconShoppingCart },
    { label: t('nav.items'), path: '/items', icon: IconPackage },
    { label: t('nav.parties'), path: '/parties', icon: IconUsers },
    { label: t('nav.purchases'), path: '/purchases', icon: IconTruckDelivery },
    { label: t('nav.cash'), path: '/cash', icon: IconCash },
    { label: t('nav.reports'), path: '/reports', icon: IconReportAnalytics },
    { label: t('nav.settings'), path: '/settings', icon: IconSettings }
  ]

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
            const Icon = item.icon
            const active = location.pathname === item.path
            return (
              <NavLink
                key={item.path}
                label={item.label}
                leftSection={<Icon size={20} stroke={1.5} />}
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
