import React, { useEffect, useState } from 'react'
import { Button, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import type { Shift } from '@shared/types'
import { callApi } from '../../lib/api'
import { moneyText, parseMoney } from '../sale/moneyText'

interface Props {
  opened: boolean
  onClose: () => void
  onOpened: (shift: Shift) => void
}

export const OpenShiftDialog: React.FC<Props> = ({ opened, onClose, onOpened }) => {
  const { t } = useTranslation()
  const [cash, setCash] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (opened) setCash(moneyText(0))
  }, [opened])

  const amount = parseMoney(cash)

  const submit = async (): Promise<void> => {
    if (amount === null || busy) return
    setBusy(true)
    const res = await callApi(() => window.api.cash.open({ openingCash: amount }))
    setBusy(false)
    if (res) {
      onOpened(res)
      onClose()
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t('cash.openShift')} centered>
      <form onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">{t('cash.openHint')}</Text>
          <TextInput
            data-autofocus
            size="md"
            label={t('cash.openingCash')}
            value={cash}
            onChange={(e) => setCash(e.currentTarget.value)}
            onFocus={(e) => e.currentTarget.select()}
            error={amount === null ? t('sale.badAmount') : undefined}
          />
          <Button type="submit" loading={busy} disabled={amount === null}>{t('cash.openShift')} (Enter)</Button>
        </Stack>
      </form>
    </Modal>
  )
}
