import React, { useEffect, useState } from 'react'
import { AppShell, NavLink, Group, Title, Text, Stack, Badge, Button, Box } from '@mantine/core'
import {
  IconShoppingCart,
  IconPackage,
  IconUsers,
  IconTruckDelivery,
  IconCash,
  IconReportAnalytics,
  IconSettings,
  IconLayoutDashboard,
  IconLogout,
  IconUser
} from '@tabler/icons-react'
import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useModules } from '../modules'
import { useAuth } from '../context/AuthContext'
import { ColorSchemeToggle } from '../components/ColorSchemeToggle'

export const AppLayout: React.FC = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { activeUiModules } = useModules()
  const { user, logout } = useAuth()

  // Guard: if cashier visits /settings, redirect to /
  useEffect(() => {
    if (user && user.role === 'cashier' && location.pathname === '/settings') {
      navigate('/', { replace: true })
    }
  }, [user, location.pathname, navigate])

  const coreNavItems = [
    { label: t('nav.sale'), path: '/', icon: <IconShoppingCart size={20} stroke={1.5} /> },
    // Only worth a menu entry when an enabled module adds widgets to it.
    ...(activeUiModules.some((m) => m.dashboardWidgets?.length)
      ? [{ label: t('nav.dashboard'), path: '/dashboard', icon: <IconLayoutDashboard size={20} stroke={1.5} /> }]
      : []),
    { label: t('nav.items'), path: '/items', icon: <IconPackage size={20} stroke={1.5} /> },
    { label: t('nav.parties'), path: '/parties', icon: <IconUsers size={20} stroke={1.5} /> },
    { label: t('nav.purchases'), path: '/purchases', icon: <IconTruckDelivery size={20} stroke={1.5} /> },
    { label: t('nav.cash'), path: '/cash', icon: <IconCash size={20} stroke={1.5} /> },
    // Reports show profit and cost, so they are for the owner only.
    ...(user?.role === 'owner'
      ? [{ label: t('nav.reports'), path: '/reports', icon: <IconReportAnalytics size={20} stroke={1.5} /> }]
      : [])
  ]

  const moduleNavItems = activeUiModules.flatMap((mod) =>
    mod.menu
      .filter((item) => !item.roles || (user && item.roles.includes(user.role)))
      .map((item) => ({
        label: t(item.label),
        path: item.path,
        icon: item.icon
      }))
  )

  const navItems = [...coreNavItems, ...moduleNavItems]

  // Role-based Settings menu hiding: only owner can access and see Settings
  if (user?.role === 'owner') {
    navItems.push({
      label: t('nav.settings'),
      path: '/settings',
      icon: <IconSettings size={20} stroke={1.5} />
    })
  }

  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    window.api?.app.getVersion().then((res) => {
      if (res.ok) {
        setVersion(`v${res.data}`)
      }
    })
  }, [])

  const handleLogout = async (): Promise<void> => {
    await logout()
    navigate('/login')
  }

  return (
    <AppShell navbar={{ width: 220, breakpoint: 'sm' }} padding="md">
      <AppShell.Navbar p="xs" style={{ display: 'flex', flexDirection: 'column' }}>
        <Group
          justify="space-between"
          wrap="nowrap"
          mb="md"
          px="xs"
          py="xs"
          style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
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
          <ColorSchemeToggle />
        </Group>

        <Stack gap="xs" style={{ flex: 1, overflowY: 'auto' }}>
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

        {user && (
          <Box pt="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <Group justify="space-between" mb="xs" px="xs">
              <Group gap="xs">
                <IconUser size={16} />
                <Text size="xs" fw={600} truncate style={{ maxWidth: 100 }}>
                  {user.name}
                </Text>
              </Group>
              <Badge
                size="xs"
                color={
                  user.role === 'owner' ? 'blue' : user.role === 'manager' ? 'teal' : 'orange'
                }
              >
                {t(`roles.${user.role}`)}
              </Badge>
            </Group>
            <Button
              fullWidth
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<IconLogout size={14} />}
              onClick={handleLogout}
            >
              {t('auth.logout')}
            </Button>
          </Box>
        )}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
