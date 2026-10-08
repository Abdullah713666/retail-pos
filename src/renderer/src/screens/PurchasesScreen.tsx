import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Center, Group, Loader, Pagination, Select, Table, Text, TextInput } from '@mantine/core'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import type { Purchase } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { PurchaseFormModal } from './purchases/PurchaseFormModal'
import { PurchaseDetailModal } from './purchases/PurchaseDetailModal'

const PAGE_SIZE = 20

export const PurchasesScreen: React.FC = () => {
  const { t } = useTranslation()
  const searchRef = useRef<HTMLInputElement>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [suppliers, setSuppliers] = useState<Array<{ value: string; label: string }>>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const res = await window.api.purchases.list({
        query: query.trim() || undefined,
        supplierId: supplierId ? Number(supplierId) : undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE
      })
      if (res.ok) {
        setPurchases(res.data.purchases)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [query, supplierId, from, to, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void window.api.parties.list({ type: 'supplier', pageSize: 200 }).then((r) => {
      if (r.ok) setSuppliers(r.data.parties.map((p) => ({ value: String(p.id), label: p.name })))
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (formOpen || detailId !== null) return
      if (e.key === 'F1') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Insert') {
        e.preventDefault()
        setFormOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [formOpen, detailId])

  return (
    <div>
      <PageHeader
        title={t('screens.purchases.title')}
        subtitle={t('screens.purchases.subtitle')}
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setFormOpen(true)}>
            {t('purchases.new')}
          </Button>
        }
      />
      <Card withBorder shadow="sm" p="md" radius="md" mb="md">
        <Group align="flex-end">
          <TextInput
            ref={searchRef}
            style={{ flex: 1 }}
            leftSection={<IconSearch size={16} />}
            placeholder={t('purchases.searchPlaceholder')}
            value={query}
            onChange={(e) => { setQuery(e.currentTarget.value); setPage(1) }}
          />
          <Select
            w={200} clearable searchable
            placeholder={t('purchases.allSuppliers')}
            data={suppliers}
            value={supplierId}
            onChange={(v) => { setSupplierId(v); setPage(1) }}
          />
          <TextInput type="date" label={t('purchases.from')} value={from} onChange={(e) => { setFrom(e.currentTarget.value); setPage(1) }} />
          <TextInput type="date" label={t('purchases.to')} value={to} onChange={(e) => { setTo(e.currentTarget.value); setPage(1) }} />
        </Group>
      </Card>

      <Card withBorder shadow="sm" p="xs" radius="md">
        {loading ? (
          <Center py="xl"><Loader size="md" /></Center>
        ) : purchases.length === 0 ? (
          <Center py="xl">
            <div style={{ textAlign: 'center' }}>
              <Text fw={600}>{t('purchases.none')}</Text>
              <Text size="sm" c="dimmed">{t('purchases.noneHint')}</Text>
            </div>
          </Center>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('purchases.colDate')}</Table.Th>
                <Table.Th>{t('purchases.colBill')}</Table.Th>
                <Table.Th>{t('purchases.colSupplier')}</Table.Th>
                <Table.Th ta="right">{t('purchases.colTotal')}</Table.Th>
                <Table.Th ta="right">{t('purchases.colPaid')}</Table.Th>
                <Table.Th ta="right">{t('purchases.colReturned')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {purchases.map((p) => (
                <Table.Tr
                  key={p.id}
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setDetailId(p.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setDetailId(p.id)}
                >
                  <Table.Td>{p.purchaseDate}</Table.Td>
                  <Table.Td>{p.billNo || '-'}</Table.Td>
                  <Table.Td fw={500}>{p.supplierName}</Table.Td>
                  <Table.Td ta="right">{formatPKR(p.total)}</Table.Td>
                  <Table.Td ta="right">{formatPKR(p.paid)}</Table.Td>
                  <Table.Td ta="right">{p.returnedTotal > 0 ? formatPKR(p.returnedTotal) : '-'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {total > PAGE_SIZE && (
          <Group justify="center" p="md">
            <Pagination value={page} onChange={setPage} total={Math.ceil(total / PAGE_SIZE)} />
          </Group>
        )}
      </Card>

      <PurchaseFormModal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); setPage(1); void load() }}
      />
      <PurchaseDetailModal purchaseId={detailId} onClose={() => setDetailId(null)} onChanged={() => void load()} />
    </div>
  )
}
