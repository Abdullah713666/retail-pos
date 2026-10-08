import React from 'react'
import { Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'

// balance > 0: party owes the shop. balance < 0: the shop owes the party. (See ledger/service.ts)
export const BalanceText: React.FC<{ balance: number; fw?: number }> = ({ balance, fw = 600 }) => {
  const { t } = useTranslation()
  if (balance === 0) return <Text fw={fw} c="dimmed">{formatPKR(0)}</Text>
  return (
    <Text fw={fw} c={balance > 0 ? 'red.7' : 'teal.8'} span>
      {formatPKR(Math.abs(balance))}{' '}
      <Text span size="xs" c="dimmed">
        {balance > 0 ? t('parties.toReceive') : t('parties.toPay')}
      </Text>
    </Text>
  )
}
