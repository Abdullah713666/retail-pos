import React from 'react'
import { Container, Paper, Title, Text, Button, Stack, Code, Center } from '@mantine/core'
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

interface MigrationErrorScreenProps {
  error?: string | null
  onRetry?: () => void
}

export const MigrationErrorScreen: React.FC<MigrationErrorScreenProps> = ({ error, onRetry }) => {
  const { t } = useTranslation()

  const handleRetry = (): void => {
    if (onRetry) {
      onRetry()
    } else {
      window.location.reload()
    }
  }

  return (
    <Center style={{ minHeight: '100vh', backgroundColor: 'var(--mantine-color-gray-1)' }}>
      <Container size="sm">
        <Paper withBorder shadow="md" p="xl" radius="md">
          <Stack align="center" gap="md">
            <IconAlertTriangle size={64} color="var(--mantine-color-red-6)" />
            <Title order={2} c="red" ta="center">
              {t('migrationError.title')}
            </Title>
            <Text c="dimmed" size="md" ta="center">
              {t('migrationError.description')}
            </Text>
            {error && (
              <Stack gap="xs" style={{ width: '100%' }}>
                <Text size="xs" c="dimmed">
                  {t('migrationError.details')}
                </Text>
                <Code block color="red">
                  {error}
                </Code>
              </Stack>
            )}
            <Button
              leftSection={<IconRefresh size={18} />}
              color="red"
              size="md"
              onClick={handleRetry}
              mt="md"
            >
              {t('migrationError.retry')}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Center>
  )
}
