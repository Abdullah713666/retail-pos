import React, { useState } from 'react'
import { Button, Group, NumberInput, SegmentedControl, Stack, Table, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import type { Sale } from '@shared/types'
import { callApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { ApprovalFields, type ApprovalValue } from './ApprovalFields'

interface Props {
  sale: Sale
  onChanged: (id: number) => void
}

/** Return lines / void one invoice. Quantities are in BASE units (tablets, pieces...). */
export const InvoiceDetail: React.FC<Props> = ({ sale, onChanged }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [qtys, setQtys] = useState<Record<number, number | string>>({})
  const [refundTo, setRefundTo] = useState<'auto' | 'cash' | 'credit'>('auto')
  const [mode, setMode] = useState<'return' | 'void'>('return')
  const [reason, setReason] = useState('')
  const [approval, setApproval] = useState<ApprovalValue>({ userId: null, pin: '' })
  const [busy, setBusy] = useState(false)

  const active = sale.status === 'completed'
  const needsPin = mode === 'void' || user?.role === 'cashier'

  const doReturn = async (): Promise<void> => {
    const lines = Object.entries(qtys)
      .map(([id, q]) => ({ saleLineId: Number(id), qtyBase: Number(q) }))
      .filter((l) => l.qtyBase > 0)
    if (lines.length === 0) return
    setBusy(true)
    const res = await callApi(() =>
      window.api.sales.return({
        saleId: sale.id,
        lines,
        refundTo,
        approval: approval.userId !== null && approval.pin ? { userId: approval.userId, pin: approval.pin } : null
      })
    )
    setBusy(false)
    if (res) {
      notifications.show({ color: 'green', message: t('sale.returnDone', { amount: formatPKR(res.total) }) })
      setQtys({})
      setApproval({ ...approval, pin: '' })
      onChanged(sale.id)
    }
  }

  const doVoid = async (): Promise<void> => {
    if (approval.userId === null) return
    setBusy(true)
    const res = await callApi(() =>
      window.api.sales.void({ saleId: sale.id, reason, approval: { userId: approval.userId as number, pin: approval.pin } })
    )
    setBusy(false)
    if (res !== null) {
      notifications.show({ color: 'green', message: t('sale.voidDone') })
      setApproval({ ...approval, pin: '' })
      onChanged(sale.id)
    }
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={700}>{sale.invoiceNo} · {sale.partyName ?? t('sale.walkIn')}</Text>
        <Text fw={700}>{formatPKR(sale.total)}</Text>
      </Group>
      {sale.status === 'void' && <Text c="red">{t('sale.isVoid')}: {sale.voidReason}</Text>}
      <Table verticalSpacing={4}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('sale.item')}</Table.Th>
            <Table.Th ta="right">{t('sale.sold')}</Table.Th>
            <Table.Th ta="right">{t('sale.returned')}</Table.Th>
            <Table.Th ta="right">{t('sale.lineTotal')}</Table.Th>
            {active && mode === 'return' && <Table.Th w={110}>{t('sale.returnQty')}</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sale.lines.map((l) => (
            <Table.Tr key={l.id}>
              <Table.Td>{l.itemName} <Text span size="xs" c="dimmed">({l.qty} {l.unitName}{l.unitFactor > 1 ? ` = ${l.qtyBase}` : ''})</Text></Table.Td>
              <Table.Td ta="right">{l.qtyBase}</Table.Td>
              <Table.Td ta="right">{l.returnedBase}</Table.Td>
              <Table.Td ta="right">{formatPKR(l.netTotal)}</Table.Td>
              {active && mode === 'return' && (
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={0}
                    max={l.qtyBase - l.returnedBase}
                    allowDecimal={false}
                    allowNegative={false}
                    value={qtys[l.id] ?? ''}
                    onChange={(v) => setQtys((q) => ({ ...q, [l.id]: v }))}
                    disabled={l.qtyBase - l.returnedBase <= 0}
                  />
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {active && (
        <>
          <SegmentedControl
            value={mode}
            onChange={(v) => setMode(v as 'return' | 'void')}
            data={[{ value: 'return', label: t('sale.return') }, { value: 'void', label: t('sale.void') }]}
          />
          {mode === 'return' && (
            <SegmentedControl
              size="xs"
              value={refundTo}
              onChange={(v) => setRefundTo(v as 'auto' | 'cash' | 'credit')}
              data={[
                { value: 'auto', label: t('sale.refundAuto') },
                { value: 'cash', label: t('sale.refundCash') },
                { value: 'credit', label: t('sale.refundCredit'), disabled: sale.partyId === null }
              ]}
            />
          )}
          {mode === 'void' && (
            <TextInput label={t('sale.voidReason')} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          )}
          {needsPin && <ApprovalFields value={approval} onChange={setApproval} />}
          <Button
            color={mode === 'void' ? 'red' : 'blue'}
            loading={busy}
            onClick={() => void (mode === 'void' ? doVoid() : doReturn())}
            disabled={mode === 'void' ? !reason.trim() || !approval.pin : false}
          >
            {mode === 'void' ? t('sale.voidSale') : t('sale.doReturn')}
          </Button>
        </>
      )}
    </Stack>
  )
}
