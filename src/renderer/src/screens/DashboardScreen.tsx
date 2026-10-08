import React from 'react'
import { SimpleGrid, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/PageHeader'
import { useModules } from '../modules'

/** Home overview. Industry modules add their own widgets here (UiModule.dashboardWidgets). */
export const DashboardScreen: React.FC = () => {
  const { t } = useTranslation()
  const { activeUiModules } = useModules()
  const widgets = activeUiModules.flatMap((m) => (m.dashboardWidgets ?? []).map((W, i) => <W key={`${m.id}-${i}`} />))
  return (
    <div>
      <PageHeader title={t('screens.dashboard.title')} subtitle={t('screens.dashboard.subtitle')} />
      {widgets.length === 0 ? <Text c="dimmed">{t('screens.dashboard.empty')}</Text> : <SimpleGrid cols={{ base: 1, md: 2 }}>{widgets}</SimpleGrid>}
    </div>
  )
}
