import React, { useEffect, useState } from 'react'
import { Card, Group, Text, UnstyledButton } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { PharmacyDashboard } from '@shared/types'

const Stat: React.FC<{ label: string; value: number; color: string; to: string }> = ({ label, value, color, to }) => {
  const navigate = useNavigate()
  return (
    <UnstyledButton onClick={() => navigate(to)}>
      <Text size="xl" fw={700} c={value > 0 ? color : undefined}>{value}</Text>
      <Text size="xs" c="dimmed">{label}</Text>
    </UnstyledButton>
  )
}

export const PharmacyDashboardWidget: React.FC = () => {
  const { t } = useTranslation()
  const [d, setD] = useState<PharmacyDashboard | null>(null)

  useEffect(() => {
    void window.api.pharmacy.dashboard().then((r) => r.ok && setD(r.data))
  }, [])

  return (
    <Card withBorder radius="md" p="md">
      <Text fw={600} mb="xs">{t('pharmacy.widgetTitle')}</Text>
      <Group gap="xl">
        <Stat label={t('pharmacy.nearExpiry')} value={d?.within30 ?? 0} color="orange" to="/pharmacy/expiry" />
        <Stat label={t('pharmacy.expiredCount')} value={d?.expired ?? 0} color="red" to="/pharmacy/expiry" />
        <Stat label={t('pharmacy.wantCount')} value={d?.wantBookOpen ?? 0} color="blue" to="/pharmacy/want-book" />
      </Group>
    </Card>
  )
}
