import React from 'react'
import { Card, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/PageHeader'

export const ItemsScreen: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div>
      <PageHeader
        title={t('screens.items.title')}
        subtitle={t('screens.items.subtitle')}
      />
      <Card withBorder shadow="sm" p="lg" radius="md">
        <Text>{t('common.comingSoon')}</Text>
      </Card>
    </div>
  )
}
