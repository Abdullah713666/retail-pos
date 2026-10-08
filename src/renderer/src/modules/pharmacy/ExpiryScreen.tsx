import React, { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Center, Group, SegmentedControl, Select, Table, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBrandWhatsapp, IconPrinter } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { ExpiryRange, ExpiryRow } from '@shared/types'
import { PageHeader } from '../../components/PageHeader'
import { copyText } from './copy'
import { expiryWhatsappText } from './whatsapp'

export const ExpiryScreen: React.FC = () => {
  const { t } = useTranslation()
  const [range, setRange] = useState<string>('30')
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Array<{ value: string; label: string }>>([])
  const [rows, setRows] = useState<ExpiryRow[]>([])
  const [shopName, setShopName] = useState('')

  useEffect(() => {
    void window.api.parties.list({ type: 'supplier', activeOnly: true, pageSize: 200 }).then((r) => {
      if (r.ok) setSuppliers(r.data.parties.map((p) => ({ value: String(p.id), label: p.name })))
    })
    void window.api.settings.get('shop_name').then((r) => r.ok && setShopName(r.data ?? ''))
  }, [])

  const load = useCallback(async () => {
    const r = await window.api.pharmacy.listExpiry({
      range: (range === 'expired' ? 'expired' : Number(range)) as ExpiryRange,
      supplierId: supplierId ? Number(supplierId) : null
    })
    if (r.ok) setRows(r.data)
    else notifications.show({ color: 'red', message: r.error.message })
  }, [range, supplierId])

  useEffect(() => {
    void load()
  }, [load])

  const title = `${t('pharmacy.expiryList')} - ${t(range === 'expired' ? 'pharmacy.expired' : `pharmacy.within${range}`)}`

  const copy = async (): Promise<void> => {
    const text = expiryWhatsappText(rows, {
      title: `${shopName ? `${shopName} - ` : ''}${title}`,
      noSupplier: t('pharmacy.noSupplier'),
      batch: t('pharmacy.batch'),
      expires: t('pharmacy.exp'),
      qty: t('pharmacy.qty')
    })
    await copyText(text, t('pharmacy.copied'))
  }

  return (
    <div>
      <PageHeader title={t('screens.expiry.title')} subtitle={t('screens.expiry.subtitle')} />
      <Group mb="sm" className="no-print" align="flex-end">
        <SegmentedControl
          value={range}
          onChange={setRange}
          data={[
            { value: 'expired', label: t('pharmacy.expired') },
            { value: '30', label: t('pharmacy.within30') },
            { value: '60', label: t('pharmacy.within60') },
            { value: '90', label: t('pharmacy.within90') }
          ]}
        />
        <Select
          placeholder={t('pharmacy.allSuppliers')}
          data={suppliers}
          value={supplierId}
          onChange={setSupplierId}
          clearable
          searchable
          w={220}
        />
        <Button variant="default" leftSection={<IconPrinter size={16} />} disabled={rows.length === 0} onClick={() => window.print()}>
          {t('reports.print')}
        </Button>
        <Button variant="default" leftSection={<IconBrandWhatsapp size={16} />} disabled={rows.length === 0} onClick={() => void copy()}>
          {t('pharmacy.copyWhatsapp')}
        </Button>
      </Group>

      <div className="print-area">
        <Title order={4}>{shopName}</Title>
        <Text fw={600} mb="xs">{title}</Text>
        {rows.length === 0 ? (
          <Center py="xl"><Text c="dimmed">{t('pharmacy.nothingExpiring')}</Text></Center>
        ) : (
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('reports.item')}</Table.Th>
                <Table.Th>{t('pharmacy.batch')}</Table.Th>
                <Table.Th>{t('pharmacy.exp')}</Table.Th>
                <Table.Th ta="right">{t('pharmacy.qty')}</Table.Th>
                <Table.Th>{t('reports.supplier')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={r.lotId}>
                  <Table.Td>{r.itemName}</Table.Td>
                  <Table.Td>{r.lotNo}</Table.Td>
                  <Table.Td>
                    {r.expiryDate}{' '}
                    <Badge size="xs" color={r.daysLeft < 0 ? 'red' : r.daysLeft <= 30 ? 'orange' : 'yellow'}>
                      {r.daysLeft < 0 ? t('pharmacy.daysAgo', { n: -r.daysLeft }) : t('pharmacy.daysLeft', { n: r.daysLeft })}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">{r.qtyBase} {r.unit}</Table.Td>
                  <Table.Td>{r.supplierName ?? '-'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </div>
    </div>
  )
}
