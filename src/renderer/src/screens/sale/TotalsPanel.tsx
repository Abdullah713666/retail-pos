import React from 'react'
import { Badge, Divider, Group, Paper, Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import type { SaleCart } from './useSaleCart'

export const TotalsPanel: React.FC<{ cart: SaleCart; heldCount: number }> = ({ cart, heldCount }) => {
  const { t } = useTranslation()
  const { totals } = cart
  const { customer, lines, heldSaleId } = cart.cart
  const count = lines.reduce((s, l) => s + l.qty, 0)

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text c="dimmed">{t('sale.itemsCount')}</Text>
          <Text fw={600}>{lines.length} / {count}</Text>
        </Group>
        <Group justify="space-between">
          <Text c="dimmed">{t('sale.subtotal')}</Text>
          <Text fw={600}>{formatPKR(totals.subtotal)}</Text>
        </Group>
        <Group justify="space-between">
          <Text c="dimmed">{t('sale.discount')}</Text>
          <Text fw={600} c={totals.discount > 0 ? 'green' : undefined}>
            {totals.discount > 0 ? `- ${formatPKR(totals.discount)}` : formatPKR(0)}
          </Text>
        </Group>
        <Divider />
        <Text size="sm" c="dimmed">{t('sale.total')}</Text>
        <Text style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1 }} ta="right" data-testid="sale-total">
          {formatPKR(totals.total)}
        </Text>
        <Divider />
        <Group justify="space-between" wrap="nowrap">
          <Text c="dimmed">{t('sale.customer')} (F3)</Text>
          <Text fw={600} truncate>{customer ? customer.name : t('sale.walkIn')}</Text>
        </Group>
        {customer && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed">{t('sale.owes')}</Text>
            <Text size="sm" c={customer.balance > 0 ? 'red' : undefined}>
              {formatPKR(Math.max(customer.balance, 0))}
              {customer.creditLimit > 0 ? ` / ${formatPKR(customer.creditLimit)}` : ''}
            </Text>
          </Group>
        )}
        <Group gap="xs">
          {heldSaleId != null && <Badge color="grape">{t('sale.recalled')}</Badge>}
          {heldCount > 0 && <Badge color="orange">{t('sale.heldCount', { n: heldCount })}</Badge>}
        </Group>
      </Stack>
    </Paper>
  )
}
