import React from 'react'
import { Group, Kbd, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'

const KEYS: Array<[string, string]> = [
  ['F1', 'sale.keys.search'],
  ['F2', 'sale.keys.unit'],
  ['F3', 'sale.keys.customer'],
  ['F4', 'sale.keys.discount'],
  ['F5', 'sale.keys.hold'],
  ['F6', 'sale.keys.recall'],
  ['F7', 'sale.keys.invoices'],
  ['F8', 'sale.keys.pay'],
  ['F9', 'sale.keys.print'],
  ['↑↓', 'sale.keys.line'],
  ['+ -', 'sale.keys.qty'],
  ['Del', 'sale.keys.remove'],
  ['Esc', 'sale.keys.cancel']
]

export const ShortcutBar: React.FC = () => {
  const { t } = useTranslation()
  return (
    <Group gap="md" justify="center" wrap="wrap" py={6} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
      {KEYS.map(([k, label]) => (
        <Group gap={4} key={k} wrap="nowrap">
          <Kbd size="sm">{k}</Kbd>
          <Text size="sm">{t(label)}</Text>
        </Group>
      ))}
    </Group>
  )
}
