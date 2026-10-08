import React from 'react'
import { Alert, Card, Tabs } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../context/AuthContext'
import { SalesReportTab } from './reports/SalesReportTab'
import { BalancesTab, LowStockTab, StockValueTab } from './reports/StockAndBalanceTabs'

export const ReportsScreen: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()

  if (user?.role !== 'owner') {
    return (
      <div>
        <PageHeader title={t('screens.reports.title')} subtitle={t('screens.reports.subtitle')} />
        <Alert color="red" title={t('common.error')}>{t('reports.ownerOnly')}</Alert>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={t('screens.reports.title')} subtitle={t('screens.reports.subtitle')} />
      <Card withBorder shadow="sm" p="lg" radius="md">
        <Tabs defaultValue="sales" keepMounted={false}>
          <Tabs.List mb="md" className="no-print">
            <Tabs.Tab value="sales">{t('reports.tabSales')}</Tabs.Tab>
            <Tabs.Tab value="stock">{t('reports.tabStock')}</Tabs.Tab>
            <Tabs.Tab value="low">{t('reports.tabLow')}</Tabs.Tab>
            <Tabs.Tab value="receivables">{t('reports.tabReceivables')}</Tabs.Tab>
            <Tabs.Tab value="payables">{t('reports.tabPayables')}</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="sales"><SalesReportTab /></Tabs.Panel>
          <Tabs.Panel value="stock"><StockValueTab /></Tabs.Panel>
          <Tabs.Panel value="low"><LowStockTab /></Tabs.Panel>
          <Tabs.Panel value="receivables"><BalancesTab kind="receivables" /></Tabs.Panel>
          <Tabs.Panel value="payables"><BalancesTab kind="payables" /></Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  )
}
