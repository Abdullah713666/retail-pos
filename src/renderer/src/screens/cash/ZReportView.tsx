import React from 'react'
import { Divider, Group, Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import type { ZReport } from '@shared/types'

const Row: React.FC<{ label: string; value: string; bold?: boolean; color?: string }> = ({ label, value, bold, color }) => (
  <Group justify="space-between" wrap="nowrap">
    <Text size="sm" fw={bold ? 700 : 400}>{label}</Text>
    <Text size="sm" fw={bold ? 700 : 400} c={color}>{value}</Text>
  </Group>
)

/** On-screen Z report. The `print-area` class lets window.print() print just this block. */
export const ZReportView: React.FC<{ z: ZReport }> = ({ z }) => {
  const { t } = useTranslation()
  const { shift, cash } = z
  const diff = shift.difference
  return (
    <Stack gap={4} className="print-area">
      <Text fw={700} ta="center">{t('cash.zTitle')} #{shift.id}</Text>
      {!shift.closedAt && <Text size="sm" ta="center" c="orange">{t('cash.zOpen')}</Text>}
      <Row label={t('cash.openedBy')} value={shift.userName} />
      <Row label={t('cash.opened')} value={shift.openedAt} />
      <Row label={t('cash.closed')} value={shift.closedAt ?? '-'} />
      <Divider my={4} label={t('cash.sales')} />
      <Row label={t('cash.invoices')} value={String(z.sales.count)} />
      <Row label={t('cash.grossSales')} value={formatPKR(z.sales.subtotal)} />
      <Row label={t('cash.discounts')} value={`- ${formatPKR(z.sales.discount)}`} />
      <Row label={t('cash.netSales')} value={formatPKR(z.sales.total)} bold />
      <Row label={t('cash.byCash')} value={formatPKR(z.byPayment.cash)} />
      <Row label={t('cash.byCredit')} value={formatPKR(z.byPayment.credit)} />
      <Row label={`${t('cash.returns')} (${z.returns.count})`} value={formatPKR(z.returns.total)} />
      <Row label={t('cash.voids')} value={`${z.voids.count} / ${formatPKR(z.voids.total)}`} />
      <Divider my={4} label={t('cash.drawer')} />
      <Row label={t('cash.openingCash')} value={formatPKR(cash.openingCash)} />
      <Row label={`+ ${t('cash.cashSales')}`} value={formatPKR(cash.cashSales)} />
      <Row label={`- ${t('cash.cashRefunds')}`} value={formatPKR(cash.cashRefunds)} />
      <Row label={`+ ${t('cash.in')}`} value={formatPKR(cash.cashIn)} />
      <Row label={`- ${t('cash.out')}`} value={formatPKR(cash.cashOut)} />
      <Row label={`- ${t('cash.expense')}`} value={formatPKR(cash.expenses)} />
      <Row label={`- ${t('cash.supplierPaid')}`} value={formatPKR(cash.supplierPaid)} />
      <Row label={`+ ${t('cash.customerPaid')}`} value={formatPKR(cash.customerPaid)} />
      <Row label={t('cash.expected')} value={formatPKR(cash.expectedCash)} bold />
      {shift.countedCash != null && (
        <>
          <Row label={t('cash.counted')} value={formatPKR(shift.countedCash)} bold />
          <Row
            label={t('cash.difference')}
            value={formatPKR(diff ?? 0)}
            bold
            color={diff === 0 ? 'green' : 'red'}
          />
        </>
      )}
      {z.entries.length > 0 && <Divider my={4} label={t('cash.entries')} />}
      {z.entries.map((e) => (
        <Row key={e.id} label={`${t(`cash.${e.type}`)}${e.note ? `: ${e.note}` : ''}`} value={formatPKR(e.amount)} />
      ))}
      {shift.note && <Text size="sm">{t('cash.note')}: {shift.note}</Text>}
    </Stack>
  )
}
