import React, { useEffect, useRef } from 'react'
import { Table, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import { lineAmounts } from '@shared/sale-calc'
import type { SaleCart } from './useSaleCart'
import { lineFactor, lineUnitPrice } from './useSaleCart'
import { useModules } from '../../modules'

export const SaleLineGrid: React.FC<{ cart: SaleCart }> = ({ cart }) => {
  const { t } = useTranslation()
  const { lines, selected } = cart.cart
  const { activeUiModules } = useModules()
  const selRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    selRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selected, lines.length])

  if (lines.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl" size="lg">
        {t('sale.empty')}
      </Text>
    )
  }

  return (
    <Table highlightOnHover verticalSpacing={6} stickyHeader>
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={36}>#</Table.Th>
          <Table.Th>{t('sale.item')}</Table.Th>
          <Table.Th>{t('sale.unit')}</Table.Th>
          <Table.Th ta="right">{t('sale.qty')}</Table.Th>
          <Table.Th ta="right">{t('sale.price')}</Table.Th>
          <Table.Th ta="right">{t('sale.disc')}</Table.Th>
          <Table.Th ta="right">{t('sale.lineTotal')}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {lines.map((l, i) => {
          const price = lineUnitPrice(l)
          const a = lineAmounts(price, l.qty, l.discount, l.discountBp)
          const short = l.item.trackStock === 1 && l.qty * lineFactor(l) > l.item.stockCache
          const isSel = i === selected
          return (
            <Table.Tr
              key={l.key}
              ref={isSel ? selRef : undefined}
              onClick={() => cart.select(i)}
              style={{ background: isSel ? 'var(--mantine-color-blue-light)' : undefined, cursor: 'pointer' }}
            >
              <Table.Td>{i + 1}</Table.Td>
              <Table.Td>
                <Text fw={600} size="md">{l.item.name}</Text>
                {activeUiModules.map((mod) => {
                  const Info = mod.saleLineInfo
                  return Info ? <Info key={mod.id} itemId={l.item.id} qtyBase={l.qty * lineFactor(l)} /> : null
                })}
                {short && (
                  <Text size="xs" c="red">
                    {t('sale.lowStock', { n: l.item.stockCache })}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{l.unit?.name ?? l.item.baseUnit}</Table.Td>
              <Table.Td ta="right"><Text fw={700} size="md">{l.qty}</Text></Table.Td>
              <Table.Td ta="right">{formatPKR(price)}</Table.Td>
              <Table.Td ta="right">
                {a.discount > 0 ? `${formatPKR(a.discount)}${l.discountBp != null ? ` (${l.discountBp / 100}%)` : ''}` : ''}
              </Table.Td>
              <Table.Td ta="right"><Text fw={700}>{formatPKR(a.lineTotal)}</Text></Table.Td>
            </Table.Tr>
          )
        })}
      </Table.Tbody>
    </Table>
  )
}
