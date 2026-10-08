import React, { useState } from 'react'
import { Stack, Text, Button, Modal, PasswordInput, Alert, Group, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { RecoveryCodeDisplay } from '../../components/RecoveryCodeDisplay'

interface Props {
  hasCode: boolean
  shopName: string
  onChanged: () => void
}

export const RecoverySection: React.FC<Props> = ({ hasCode, shopName, onChanged }) => {
  const { t } = useTranslation()
  const [opened, setOpened] = useState(false)
  const [pin, setPin] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const close = (): void => {
    // The code is only ever held in this component while the dialog is open.
    setCode(null)
    setPin('')
    setError(null)
    setAcknowledged(false)
    setOpened(false)
    onChanged()
  }

  const generate = async (): Promise<void> => {
    setError(null)
    setBusy(true)
    try {
      const res = await window.api.recovery.regenerate({ pin })
      if (res.ok) setCode(res.data.code)
      else setError(res.error.message)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      setPin('')
    }
  }

  return (
    <Stack gap="xs" mt="xl">
      <Title order={5}>{t('recovery.sectionTitle')}</Title>
      <Text size="sm" c="dimmed">
        {hasCode ? t('recovery.sectionHas') : t('recovery.sectionNone')}
      </Text>
      <Group>
        <Button variant="light" onClick={() => setOpened(true)}>
          {t('recovery.generate')}
        </Button>
      </Group>

      <Modal
        opened={opened}
        onClose={() => (code && !acknowledged ? undefined : close())}
        closeOnClickOutside={false}
        title={t('recovery.generate')}
      >
        {code ? (
          <Stack gap="md">
            <RecoveryCodeDisplay
              code={code}
              shopName={shopName}
              acknowledged={acknowledged}
              onAcknowledged={setAcknowledged}
            />
            <Button onClick={close} disabled={!acknowledged}>
              {t('recovery.done')}
            </Button>
          </Stack>
        ) : (
          <Stack gap="md">
            {error && <Alert color="red">{error}</Alert>}
            <Text size="sm">{t('recovery.generateWarn')}</Text>
            <PasswordInput
              label={t('pin.current')}
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.currentTarget.value.replace(/\D/g, ''))}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={close}>
                {t('settings.cancel')}
              </Button>
              <Button onClick={generate} loading={busy} disabled={pin.length < 4}>
                {t('recovery.generate')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
