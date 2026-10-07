import React from 'react'
import { Card, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/PageHeader'

export const SaleScreen: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div>
      <PageHeader
        title={t('screens.sale.title')}
        subtitle={t('screens.sale.subtitle')}
      />
      <Card withBorder shadow="sm" p="lg" radius="md">
        <Text>{t('common.comingSoon')}</Text>
      </Card>
    </div>
  )
}
