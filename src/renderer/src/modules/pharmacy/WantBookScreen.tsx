import React, { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Card, Center, Group, NumberInput, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBrandWhatsapp, IconPlus } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { WantBookEntry, WantStatus } from '@shared/types'
import { PageHeader } from '../../components/PageHeader'
import { copyText } from './copy'
import { wantBookWhatsappText } from './whatsapp'

export const WantBookScreen: React.FC = () => {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<WantBookEntry[]>([])
  const [suppliers, setSuppliers] = useState<Array<{ value: string; label: string }>>([])
  const [itemOptions, setItemOptions] = useState<Array<{ value: string; label: string }>>([])
  const [itemId, setItemId] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')
  const [qty, setQty] = useState<number | ''>(1)
  const [supplierId, setSupplierId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await window.api.pharmacy.wantBookList('active')
    if (r.ok) setEntries(r.data)
  }, [])

  useEffect(() => {
    void load()
    void window.api.parties.list({ type: 'supplier', activeOnly: true, pageSize: 200 }).then((r) => {
      if (r.ok) setSuppliers(r.data.parties.map((p) => ({ value: String(p.id), label: p.name })))
    })
  }, [load])

  const searchItems = (q: string): void => {
    if (q.trim().length < 2) return
    void window.api.items.search(q, 20).then((r) => {
      if (r.ok) setItemOptions(r.data.map((i) => ({ value: String(i.id), label: i.name })))
    })
  }

  const add = async (): Promise<void> => {
    const res = await window.api.pharmacy.wantBookAdd({
      itemId: itemId ? Number(itemId) : null,
      freeText: itemId ? null : freeText,
      qty: typeof qty === 'number' ? qty : 0,
      supplierId: supplierId ? Number(supplierId) : null
    })
    if (!res.ok) {
      notifications.show({ color: 'red', message: res.error.message })
      return
    }
    setItemId(null)
    setFreeText('')
    setQty(1)
    setSupplierId(null)
    void load()
  }

  const setStatus = async (id: number, status: WantStatus): Promise<void> => {
    const res = await window.api.pharmacy.wantBookSetStatus({ id, status })
    if (res.ok) void load()
    else notifications.show({ color: 'red', message: res.error.message })
  }

  const groups = new Map<string, WantBookEntry[]>()
  for (const e of entries) {
    const k = e.supplierName ?? t('pharmacy.noSupplier')
    groups.set(k, [...(groups.get(k) ?? []), e])
  }

  const copy = async (): Promise<void> => {
    const open = entries.filter((e) => e.status === 'open')
    await copyText(
      wantBookWhatsappText(open, { title: t('pharmacy.wantBookTitle'), noSupplier: t('pharmacy.noSupplier') }),
      t('pharmacy.copied')
    )
  }

  return (
    <div>
      <PageHeader
        title={t('pharmacy.wantBookTitle')}
        subtitle={t('pharmacy.wantBookSubtitle')}
        actions={
          <Button variant="default" leftSection={<IconBrandWhatsapp size={16} />} disabled={!entries.some((e) => e.status === 'open')} onClick={() => void copy()}>
            {t('pharmacy.copyWhatsapp')}
          </Button>
        }
      />
      <Card withBorder radius="md" p="sm" mb="md">
        <Group align="flex-end" wrap="wrap">
          <Select
            label={t('pharmacy.medicine')}
            placeholder={t('pharmacy.searchMedicine')}
            data={itemOptions}
            value={itemId}
            onChange={setItemId}
            onSearchChange={searchItems}
            searchable
            clearable
            filter={({ options }) => options}
            w={240}
          />
          {!itemId && (
            <TextInput label={t('pharmacy.orTypeName')} value={freeText} onChange={(e) => setFreeText(e.currentTarget.value)} maxLength={120} w={200} />
          )}
          <NumberInput label={t('pharmacy.qty')} min={1} allowDecimal={false} value={qty} onChange={(v) => setQty(typeof v === 'number' ? v : '')} w={90} />
          <Select label={t('reports.supplier')} placeholder={t('pharmacy.lastSupplier')} data={suppliers} value={supplierId} onChange={setSupplierId} clearable searchable w={200} />
          <Button leftSection={<IconPlus size={16} />} disabled={!itemId && !freeText.trim()} onClick={() => void add()}>
            {t('pharmacy.add')}
          </Button>
        </Group>
      </Card>

      {entries.length === 0 ? (
        <Center py="xl"><Text c="dimmed">{t('pharmacy.wantEmpty')}</Text></Center>
      ) : (
        <Stack>
          {[...groups.entries()].map(([supplier, list]) => (
            <Card key={supplier} withBorder radius="md" p="sm">
              <Text fw={700} mb="xs">{supplier}</Text>
              <Table>
                <Table.Tbody>
                  {list.map((e) => (
                    <Table.Tr key={e.id}>
                      <Table.Td>{e.itemName}</Table.Td>
                      <Table.Td ta="right">{e.qty}</Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light" color={e.source === 'auto' ? 'gray' : 'blue'}>{t(`pharmacy.source_${e.source}`)}</Badge>{' '}
                        <Badge size="xs" color={e.status === 'ordered' ? 'orange' : 'teal'}>{t(`pharmacy.status_${e.status}`)}</Badge>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Group gap="xs" justify="flex-end">
                          {e.status === 'open' && (
                            <Button size="compact-xs" variant="light" onClick={() => void setStatus(e.id, 'ordered')}>{t('pharmacy.markOrdered')}</Button>
                          )}
                          <Button size="compact-xs" variant="light" color="green" onClick={() => void setStatus(e.id, 'done')}>{t('pharmacy.markDone')}</Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          ))}
        </Stack>
      )}
    </div>
  )
}
