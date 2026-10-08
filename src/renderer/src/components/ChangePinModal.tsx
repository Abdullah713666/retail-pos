import React, { useState } from 'react'
import { Modal, Stack, PasswordInput, Group, Button, Alert } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'

interface Props {
  opened: boolean
  onClose: () => void
}

const digits = (v: string): string => v.replace(/\D/g, '')

export const ChangePinModal: React.FC<Props> = ({ opened, onClose }) => {
  const { t } = useTranslation()
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const close = (): void => {
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
    setError(null)
    onClose()
  }

  const submit = async (): Promise<void> => {
    setError(null)
    if (!/^\d{4,6}$/.test(newPin)) return setError(t('wizard.pinLengthError'))
    if (newPin !== confirmPin) return setError(t('wizard.pinMismatch'))
    setBusy(true)
    try {
      const res = await window.api.users.changeOwnPin({ currentPin, newPin })
      if (res.ok) {
        notifications.show({ title: t('common.success'), message: t('pin.changed'), color: 'teal' })
        close()
      } else {
        setError(res.error.message)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal opened={opened} onClose={close} title={t('pin.changeTitle')}>
      <Stack gap="md">
        {error && <Alert color="red">{error}</Alert>}
        <PasswordInput
          label={t('pin.current')}
          maxLength={6}
          value={currentPin}
          onChange={(e) => setCurrentPin(digits(e.currentTarget.value))}
        />
        <PasswordInput
          label={t('pin.new')}
          maxLength={6}
          value={newPin}
          onChange={(e) => setNewPin(digits(e.currentTarget.value))}
        />
        <PasswordInput
          label={t('pin.confirm')}
          maxLength={6}
          value={confirmPin}
          onChange={(e) => setConfirmPin(digits(e.currentTarget.value))}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            {t('settings.cancel')}
          </Button>
          <Button onClick={submit} loading={busy} disabled={!currentPin || !newPin || !confirmPin}>
            {t('pin.changeButton')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
