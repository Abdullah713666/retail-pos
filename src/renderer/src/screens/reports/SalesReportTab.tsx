import React, { useCallback, useEffect, useState } from 'react'
import { Button, Group, Loader, SegmentedControl, Stack, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { formatPKR, fromPaisa } from '@shared/money'
import { todayLocal } from '@shared/dates'
import type { SalesGroupBy, SalesReport, SalesReportRow } from '@shared/types'
import { ReportCol, ReportTable } from './ReportTable'

const money = (get: (r: SalesReportRow) => number, header: string): ReportCol<SalesReportRow> => ({
  header,
  align: 'right',
  render: (r) => formatPKR(get(r)),
  csv: (r) => fromPaisa(get(r))
})

function monthStart(): string {
  return todayLocal().slice(0, 8) + '01'
}

export const SalesReportTab: React.FC = () => {
  const { t } = useTranslation()
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(todayLocal())
  const [groupBy, setGroupBy] = useState<SalesGroupBy>('day')
  const [report, setReport] = useState<SalesReport | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    if (!from || !to) return
    setLoading(true)
    const res = await window.api.reports.sales({ from, to, groupBy })
    setLoading(false)
    if (res.ok) setReport(res.data)
    else notifications.show({ color: 'red', title: t('common.error'), message: res.error.message })
  }, [from, to, groupBy, t])

  useEffect(() => {
    load()
  }, [load])

  const labelHeader = t(`reports.by.${groupBy}`)
  const cols: Array<ReportCol<SalesReportRow>> = [
    { header: labelHeader, render: (r) => r.label, csv: (r) => r.label },
    { header: t('reports.invoices'), align: 'right', render: (r) => r.invoices, csv: (r) => r.invoices },
    ...(groupBy === 'item'
      ? [{ header: t('reports.qty'), align: 'right' as const, render: (r: SalesReportRow) => r.qty, csv: (r: SalesReportRow) => r.qty ?? 0 }]
      : []),
    money((r) => r.sales, t('reports.sales')),
    money((r) => r.returns, t('reports.returns')),
    money((r) => r.cost, t('reports.cost')),
    money((r) => r.profit, t('reports.profit'))
  ]
  const tot = report?.totals
  const m = (p: number): { text: string; csv: number } => ({ text: formatPKR(p), csv: fromPaisa(p) })
  const totals = tot
    ? [
        undefined,
        { text: String(tot.invoices), csv: tot.invoices },
        ...(groupBy === 'item' ? [undefined] : []),
        m(tot.sales), m(tot.returns), m(tot.cost), m(tot.profit)
      ]
    : undefined

  return (
    <Stack>
      <Group align="flex-end" className="no-print">
        <TextInput type="date" label={t('reports.from')} value={from} onChange={(e) => setFrom(e.currentTarget.value)} />
        <TextInput type="date" label={t('reports.to')} value={to} onChange={(e) => setTo(e.currentTarget.value)} />
        <Button variant="default" onClick={() => { setFrom(todayLocal()); setTo(todayLocal()) }}>{t('reports.today')}</Button>
        <Button variant="default" onClick={() => { setFrom(monthStart()); setTo(todayLocal()) }}>{t('reports.thisMonth')}</Button>
        <SegmentedControl
          value={groupBy}
          onChange={(v) => setGroupBy(v as SalesGroupBy)}
          data={[
            { value: 'day', label: t('reports.by.day') },
            { value: 'item', label: t('reports.by.item') },
            { value: 'user', label: t('reports.by.user') }
          ]}
        />
        {loading && <Loader size="sm" />}
      </Group>
      <ReportTable
        title={`${t('reports.salesTitle')} (${labelHeader})`}
        subtitle={`${from} - ${to}`}
        cols={cols}
        rows={report?.rows ?? []}
        totals={totals}
      />
    </Stack>
  )
}
