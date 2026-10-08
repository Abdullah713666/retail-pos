import React, { useState } from 'react'
import { Modal, Stack, PasswordInput, TextInput, Group, Button, Alert } from '@mantine/core'
import { useTranslation } from 'react-i18next'

interface Props {
  opened: boolean
  onClose: () => void
  onDone: () => void
}

const digits = (v: string): string => v.replace(/\D/g, '')

export const RecoverOwnerModal: React.FC<Props> = ({ opened, onClose, onDone }) => {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const close = (): void => {
    setCode('')
    setNewPin('')
    setConfirmPin('')
    setError(null)
    if (done) onDone()
    setDone(false)
    onClose()
  }

  const submit = async (): Promise<void> => {
    setError(null)
    if (!/^\d{4,6}$/.test(newPin)) return setError(t('wizard.pinLengthError'))
    if (newPin !== confirmPin) return setError(t('wizard.pinMismatch'))
    setBusy(true)
    try {
      const res = await window.api.auth.recoverOwnerPin({ code: code.trim(), newPin })
      if (res.ok) setDone(true)
      else setError(res.error.message)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal opened={opened} onClose={close} title={t('recovery.forgotTitle')}>
      {done ? (
        <Stack gap="md">
          <Alert color="green">{t('recovery.doneText')}</Alert>
          <Button onClick={close}>{t('recovery.backToLogin')}</Button>
        </Stack>
      ) : (
        <Stack gap="md">
          {error && <Alert color="red">{error}</Alert>}
          <TextInput
            label={t('recovery.enterCode')}
            placeholder="ABCD-EFGH-JKLM"
            value={code}
            onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
            dir="ltr"
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
            <Button onClick={submit} loading={busy} disabled={code.length < 8 || !newPin || !confirmPin}>
              {t('recovery.resetButton')}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
