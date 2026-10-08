import React, { useEffect, useState } from 'react'
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import type { CompleteSaleResult, Party } from '@shared/types'
import { moneyText, parseMoney } from './moneyText'

interface Props {
  opened: boolean
  total: number
  customer: Party | null
  onClose: () => void
  onChooseCustomer: () => void
  /** Returns the saved sale, or null if main refused it (the error toast is already shown). */
  onConfirm: (paidCash: number, paidCredit: number) => Promise<CompleteSaleResult | null>
}

export const PaymentDialog: React.FC<Props> = ({ opened, total, customer, onClose, onChooseCustomer, onConfirm }) => {
  const { t } = useTranslation()
  const [cash, setCash] = useState('')
  const [credit, setCredit] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<CompleteSaleResult | null>(null)

  useEffect(() => {
    if (opened) {
      setCash(moneyText(total))
      setCredit('')
      setDone(null)
      setBusy(false)
    }
  }, [opened, total])

  const creditN = parseMoney(credit)
  const cashN = parseMoney(cash)
  const valid = creditN !== null && cashN !== null && creditN <= total
  const due = valid ? total - creditN : 0
  const change = valid ? cashN - due : 0
  const short = valid && change < 0
  const needsCustomer = valid && creditN > 0 && !customer
  const canPay = valid && !short && !needsCustomer && !busy

  const setCreditAuto = (text: string): void => {
    setCredit(text)
    const c = parseMoney(text)
    if (c !== null && c <= total) setCash(moneyText(total - c))
  }

  const submit = async (): Promise<void> => {
    if (!canPay) return
    setBusy(true)
    const res = await onConfirm(cashN, creditN)
    setBusy(false)
    if (res) setDone(res)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.altKey && e.key === '1') {
      e.preventDefault()
      setCreditAuto('')
    } else if (e.altKey && e.key === '2') {
      e.preventDefault()
      setCreditAuto(moneyText(total))
    } else if (e.key === 'F3') {
      e.preventDefault()
      onChooseCustomer()
    }
  }

  if (done) {
    return (
      <Modal opened={opened} onClose={onClose} title={t('sale.saleDone')} centered closeOnEscape>
        <Stack align="center" gap="xs">
          <Text c="dimmed">{t('sale.invoice')} {done.sale.invoiceNo}</Text>
          <Text size="xl" fw={700}>{formatPKR(done.sale.total)}</Text>
          <Text c="dimmed">{t('sale.changeDue')}</Text>
          <Text style={{ fontSize: 40, fontWeight: 800 }} c="green">{formatPKR(done.changeDue)}</Text>
          {done.sale.paidCredit > 0 && (
            <Text size="sm" c="orange">{t('sale.onKhata', { amount: formatPKR(done.sale.paidCredit) })}</Text>
          )}
          <Button data-autofocus fullWidth size="md" onClick={onClose}>{t('sale.newSale')} (Enter)</Button>
        </Stack>
      </Modal>
    )
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t('sale.payment')} centered closeOnEscape>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        onKeyDown={onKeyDown}
      >
        <Stack gap="sm">
          <Group justify="space-between">
            <Text c="dimmed">{t('sale.total')}</Text>
            <Text fw={800} style={{ fontSize: 30 }}>{formatPKR(total)}</Text>
          </Group>
          <TextInput
            data-autofocus
            size="md"
            label={t('sale.cashReceived')}
            value={cash}
            onChange={(e) => setCash(e.currentTarget.value)}
            onFocus={(e) => e.currentTarget.select()}
            error={cashN === null ? t('sale.badAmount') : undefined}
          />
          <TextInput
            size="md"
            label={t('sale.onCredit')}
            value={credit}
            onChange={(e) => setCreditAuto(e.currentTarget.value)}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="0.00"
            error={creditN === null ? t('sale.badAmount') : creditN > total ? t('sale.creditTooMuch') : undefined}
          />
          <Group gap="xs">
            <Button size="xs" variant="light" type="button" onClick={() => setCreditAuto('')}>{t('sale.allCash')} (Alt+1)</Button>
            <Button size="xs" variant="light" color="orange" type="button" onClick={() => setCreditAuto(moneyText(total))}>
              {t('sale.allCredit')} (Alt+2)
            </Button>
          </Group>
          <Group justify="space-between">
            <Text>{customer ? `${t('sale.customer')}: ${customer.name}` : t('sale.walkIn')}</Text>
            <Button size="xs" variant="subtle" type="button" onClick={onChooseCustomer}>{t('sale.chooseCustomer')} (F3)</Button>
          </Group>
          {needsCustomer && <Text c="red" size="sm">{t('sale.creditNeedsCustomer')}</Text>}
          {short ? (
            <Text c="red" fw={700} size="lg">{t('sale.shortBy', { amount: formatPKR(-change) })}</Text>
          ) : (
            <Group justify="space-between">
              <Text c="dimmed">{t('sale.changeDue')}</Text>
              <Text fw={800} c="green" style={{ fontSize: 28 }}>{formatPKR(Math.max(change, 0))}</Text>
            </Group>
          )}
          <Button type="submit" size="md" disabled={!canPay} loading={busy}>{t('sale.completeSale')} (Enter)</Button>
        </Stack>
      </form>
    </Modal>
  )
}
