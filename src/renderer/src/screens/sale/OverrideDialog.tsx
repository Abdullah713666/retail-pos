import React, { useEffect, useState } from 'react'
import { Alert, Button, Group, Modal, Stack } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import type { Approval } from '@shared/types'
import { ApprovalFields, type ApprovalValue } from './ApprovalFields'

/** Asks for the OWNER's PIN when a module blocked a line (e.g. only expired medicine is left). */
export const OverrideDialog: React.FC<{
  message: string | null
  onCancel: () => void
  onConfirm: (a: Approval) => void
}> = ({ message, onCancel, onConfirm }) => {
  const { t } = useTranslation()
  const [value, setValue] = useState<ApprovalValue>({ userId: null, pin: '' })

  useEffect(() => {
    if (message !== null) setValue((v) => ({ ...v, pin: '' }))
  }, [message])

  const ready = value.userId !== null && /^\d{4,6}$/.test(value.pin)
  return (
    <Modal opened={message !== null} onClose={onCancel} title={t('sale.overrideTitle')} centered>
      <Stack>
        <Alert color="red">{message}</Alert>
        <ApprovalFields value={value} onChange={setValue} ownerOnly />
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>{t('sale.cancel')}</Button>
          <Button color="red" disabled={!ready} onClick={() => ready && onConfirm({ userId: value.userId!, pin: value.pin })}>
            {t('sale.overrideConfirm')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
