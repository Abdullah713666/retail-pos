import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Title,
  Text,
  Button,
  SimpleGrid,
  Group,
  Stack,
  Badge,
  Alert,
  Center,
  UnstyledButton
} from '@mantine/core'
import { IconBackspace, IconLock, IconUser, IconAlertCircle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { User } from '@shared/types'
import { useAuth } from '../context/AuthContext'

export const LoginScreen: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login } = useAuth()

  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchingUsers, setFetchingUsers] = useState(true)

  const loadUsers = useCallback(async (): Promise<void> => {
    try {
      if (window.api?.users?.list) {
        const res = await window.api.users.list()
        if (res.ok) {
          setUsers(res.data)
          if (res.data.length > 0) {
            setSelectedUser(res.data[0])
          }
        }
      }
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setFetchingUsers(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleDigit = useCallback((digit: string): void => {
    setError(null)
    setPin((prev) => (prev.length < 6 ? prev + digit : prev))
  }, [])

  const handleBackspace = useCallback((): void => {
    setError(null)
    setPin((prev) => prev.slice(0, -1))
  }, [])

  const handleClear = useCallback((): void => {
    setError(null)
    setPin('')
  }, [])

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedUser) {
      setError(t('auth.selectUser'))
      return
    }
    if (pin.length < 4) {
      setError(t('wizard.pinLengthError'))
      return
    }

    setLoading(true)
    setError(null)

    const res = await login({
      userId: selectedUser.id,
      pin
    })

    setLoading(false)

    if (res.success) {
      navigate('/')
    } else {
      setError(res.error || t('auth.invalidPin'))
      setPin('')
    }
  }, [selectedUser, pin, login, navigate, t])

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Escape') {
        handleClear()
      } else if (e.key === 'Enter') {
        handleSubmit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDigit, handleBackspace, handleClear, handleSubmit])

  const roleColor: Record<string, string> = {
    owner: 'blue',
    manager: 'teal',
    cashier: 'orange'
  }

  if (fetchingUsers) {
    return null
  }

  if (users.length === 0) {
    return (
      <Center style={{ minHeight: '80vh' }}>
        <Card withBorder p="xl" radius="md" style={{ maxWidth: 450, textAlign: 'center' }}>
          <IconAlertCircle size={48} color="orange" style={{ margin: '0 auto 16px' }} />
          <Title order={3} mb="xs">
            {t('auth.noUsersTitle')}
          </Title>
          <Text size="sm" c="dimmed" mb="lg">
            {t('auth.noUsersSubtitle')}
          </Text>
          <Button onClick={() => navigate('/setup')}>{t('auth.goToSetup')}</Button>
        </Card>
      </Center>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
      <Card withBorder shadow="md" p="xl" radius="md">
        <Group justify="center" mb="lg">
          <IconLock size={28} color="var(--mantine-color-blue-6)" />
          <Title order={2} c="blue">
            {t('auth.loginTitle')}
          </Title>
        </Group>

        {error && (
          <Alert color="red" mb="md" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
          {/* User Selection */}
          <Stack gap="xs">
            <Text fw={600} size="sm">
              {t('auth.selectUser')}
            </Text>
            {users.map((u) => {
              const isSelected = selectedUser?.id === u.id
              return (
                <UnstyledButton
                  key={u.id}
                  onClick={() => {
                    setSelectedUser(u)
                    setPin('')
                    setError(null)
                  }}
                  p="sm"
                  style={{
                    borderRadius: 8,
                    border: isSelected
                      ? '2px solid var(--mantine-color-blue-6)'
                      : '1px solid var(--mantine-color-gray-3)',
                    backgroundColor: isSelected
                      ? 'var(--mantine-color-blue-0)'
                      : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <Group gap="sm">
                    <IconUser size={24} color={isSelected ? 'var(--mantine-color-blue-6)' : 'gray'} />
                    <div>
                      <Text fw={600} size="sm">
                        {u.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        @{u.username}
                      </Text>
                    </div>
                  </Group>
                  <Badge color={roleColor[u.role] || 'gray'} size="sm">
                    {t(`roles.${u.role}`)}
                  </Badge>
                </UnstyledButton>
              )
            })}
          </Stack>

          {/* Keypad & PIN input */}
          <Stack gap="md" align="center">
            {/* PIN Display */}
            <div
              style={{
                width: '100%',
                padding: '12px 16px',
                textAlign: 'center',
                backgroundColor: 'var(--mantine-color-gray-1)',
                borderRadius: 8,
                border: '1px solid var(--mantine-color-gray-3)',
                minHeight: 52,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: 10,
                fontSize: 24,
                fontWeight: 'bold'
              }}
            >
              {pin.length === 0 ? (
                <Text size="sm" c="dimmed" style={{ letterSpacing: 'normal' }}>
                  {t('auth.pinPlaceholder')}
                </Text>
              ) : (
                '•'.repeat(pin.length)
              )}
            </div>

            {/* Numeric Keypad */}
            <SimpleGrid cols={3} spacing="xs" style={{ width: 240 }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <Button
                  key={digit}
                  size="lg"
                  variant="default"
                  onClick={() => handleDigit(digit)}
                  style={{ fontSize: 20 }}
                >
                  {digit}
                </Button>
              ))}
              <Button size="lg" color="red" variant="subtle" onClick={handleClear}>
                C
              </Button>
              <Button
                size="lg"
                variant="default"
                onClick={() => handleDigit('0')}
                style={{ fontSize: 20 }}
              >
                0
              </Button>
              <Button size="lg" variant="default" onClick={handleBackspace}>
                <IconBackspace size={20} />
              </Button>
            </SimpleGrid>

            <Button
              fullWidth
              size="md"
              color="blue"
              onClick={handleSubmit}
              loading={loading}
              disabled={pin.length < 4 || !selectedUser}
              style={{ width: 240 }}
            >
              {t('auth.loginButton')}
            </Button>
          </Stack>
        </SimpleGrid>
      </Card>
    </div>
  )
}
