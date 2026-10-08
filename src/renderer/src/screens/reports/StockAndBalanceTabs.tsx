import React, { useCallback, useEffect, useState } from 'react'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { formatPKR, fromPaisa } from '@shared/money'
import { todayLocal } from '@shared/dates'
import type { BalanceRow, LowStockRow, StockValueRow } from '@shared/types'
import { ReportCol, ReportTable } from './ReportTable'

/** Loads a report once when the tab is shown. */
function useReport<T>(fetcher: () => Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>): T | null {
  const { t } = useTranslation()
  const [data, setData] = useState<T | null>(null)
  const load = useCallback(async () => {
    const res = await fetcher()
    if (res.ok) setData(res.data)
    else notifications.show({ color: 'red', title: t('common.error'), message: res.error.message })
  }, [fetcher, t])
  useEffect(() => {
    load()
  }, [load])
  return data
}

const asOf = (t: (k: string) => string): string => `${t('reports.asOf')} ${todayLocal()}`
const text = <R,>(header: string, get: (r: R) => string): ReportCol<R> => ({ header, render: get, csv: get })
const num = <R,>(header: string, get: (r: R) => number): ReportCol<R> => ({ header, align: 'right', render: get, csv: get })
const pkr = <R,>(header: string, get: (r: R) => number): ReportCol<R> => ({
  header, align: 'right', render: (r) => formatPKR(get(r)), csv: (r) => fromPaisa(get(r))
})
const fetchStockValue = (): ReturnType<typeof window.api.reports.stockValue> => window.api.reports.stockValue()
const fetchLowStock = (): ReturnType<typeof window.api.reports.lowStock> => window.api.reports.lowStock()
const fetchReceivables = (): ReturnType<typeof window.api.reports.receivables> => window.api.reports.receivables()
const fetchPayables = (): ReturnType<typeof window.api.reports.payables> => window.api.reports.payables()

export const StockValueTab: React.FC = () => {
  const { t } = useTranslation()
  const report = useReport(fetchStockValue)
  const cols: Array<ReportCol<StockValueRow>> = [
    text(t('reports.item'), (r) => r.name),
    num(t('reports.qty'), (r) => r.qty),
    text(t('reports.unit'), (r) => r.baseUnit),
    pkr(t('reports.costEach'), (r) => r.costPrice),
    pkr(t('reports.value'), (r) => r.value)
  ]
  const total = report ? { text: formatPKR(report.totalValue), csv: fromPaisa(report.totalValue) } : undefined
  return (
    <ReportTable
      title={t('reports.stockValueTitle')}
      subtitle={asOf(t)}
      cols={cols}
      rows={report?.rows ?? []}
      totals={total ? [undefined, undefined, undefined, undefined, total] : undefined}
    />
  )
}

export const LowStockTab: React.FC = () => {
  const { t } = useTranslation()
  const rows = useReport(fetchLowStock)
  const cols: Array<ReportCol<LowStockRow>> = [
    text(t('reports.item'), (r) => r.name),
    num(t('reports.inStock'), (r) => r.qty),
    text(t('reports.unit'), (r) => r.baseUnit),
    num(t('reports.reorderLevel'), (r) => r.reorderLevel)
  ]
  return <ReportTable title={t('reports.lowStockTitle')} subtitle={asOf(t)} cols={cols} rows={rows ?? []} />
}

export const BalancesTab: React.FC<{ kind: 'receivables' | 'payables' }> = ({ kind }) => {
  const { t } = useTranslation()
  const report = useReport(kind === 'receivables' ? fetchReceivables : fetchPayables)
  const cols: Array<ReportCol<BalanceRow>> = [
    text(t(kind === 'receivables' ? 'reports.customer' : 'reports.supplier'), (r) => r.name),
    text(t('reports.phone'), (r) => r.phone ?? ''),
    pkr(t(kind === 'receivables' ? 'reports.owesUs' : 'reports.weOwe'), (r) => r.amount)
  ]
  const total = report ? { text: formatPKR(report.total), csv: fromPaisa(report.total) } : undefined
  return (
    <ReportTable
      title={t(kind === 'receivables' ? 'reports.receivablesTitle' : 'reports.payablesTitle')}
      subtitle={asOf(t)}
      cols={cols}
      rows={report?.rows ?? []}
      totals={total ? [undefined, undefined, total] : undefined}
    />
  )
}
