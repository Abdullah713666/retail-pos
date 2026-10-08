import React, { useEffect, useState } from 'react'
import { Modal, TextInput, Button, Group, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { toPaisa } from '@shared/money'
import type { Party } from '@shared/types'
import { BalanceText } from './BalanceText'

interface Props {
  opened: boolean
  onClose: () => void
  party: Party | null
  onSaved: () => void
}

// Customer -> "Receive payment" (money in). Supplier -> "Make payment" (money out).
export const PaymentModal: React.FC<Props> = ({ opened, onClose, party, onSaved }) => {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (opened) {
      setAmount('')
      setNote('')
    }
  }, [opened])

  if (!party) return null
  const isCustomer = party.type === 'customer'

  let paisa = 0
  try {
    paisa = toPaisa(amount || '0')
  } catch {
    paisa = 0
  }
  const valid = Number.isSafeInteger(paisa) && paisa > 0
  // Preview only; the service posts the entry and returns the real balance.
  const after = party.balance + (isCustomer ? -paisa : paisa)

  const handleSave = async (): Promise<void> => {
    if (!valid || saving) return
    setSaving(true)
    try {
      const res = await window.api.ledger.recordPayment({ partyId: party.id, amount: paisa, note: note || null })
      if (res.ok) {
        notifications.show({ color: 'green', message: t('parties.paymentSaved') })
        onSaved()
      } else {
        notifications.show({ color: 'red', message: res.error.message })
      }
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      title={<Text fw={600}>{t(isCustomer ? 'parties.receivePayment' : 'parties.makePayment')}: {party.name}</Text>}
    >
      <Stack gap="sm" onKeyDown={(e) => e.key === 'Enter' && handleSave()}>
        <Group justify="space-between">
          <Text size="sm">{t('parties.currentBalance')}</Text>
          <BalanceText balance={party.balance} />
        </Group>
        <TextInput
          label={t('parties.amount')}
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.value)}
          data-autofocus
          size="lg"
        />
        <TextInput label={t('parties.note')} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Group justify="space-between">
          <Text size="sm">{t('parties.balanceAfter')}</Text>
          <BalanceText balance={valid ? after : party.balance} />
        </Group>
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            {t('items.cancel')}
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!valid}>
            {t(isCustomer ? 'parties.receive' : 'parties.pay')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
