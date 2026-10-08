import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Card, Table, Group, TextInput, Select, Button, Badge, ActionIcon, Pagination, Text, Center, Loader, Tabs, Tooltip
} from '@mantine/core'
import {
  IconSearch, IconPlus, IconEdit, IconEyeOff, IconEye, IconFileText, IconCash
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/PageHeader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { PartyFormModal } from './parties/PartyFormModal'
import { PaymentModal } from './parties/PaymentModal'
import { StatementModal } from './parties/StatementModal'
import { BalanceText } from './parties/BalanceText'
import { formatPKR } from '@shared/money'
import type { Party, PartyType } from '@shared/types'

export const PartiesScreen: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isManager = user?.role === 'owner' || user?.role === 'manager'
  const searchRef = useRef<HTMLInputElement>(null)

  const [type, setType] = useState<PartyType>('customer')
  const [parties, setParties] = useState<Party[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [query, setQuery] = useState('')
  const [activeOnly, setActiveOnly] = useState('active')
  const [loading, setLoading] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Party | null>(null)
  const [paying, setPaying] = useState<Party | null>(null)
  const [statementFor, setStatementFor] = useState<Party | null>(null)
  const [deactivating, setDeactivating] = useState<Party | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const res = await window.api.parties.list({
        type,
        query: query.trim() || undefined,
        activeOnly: activeOnly === 'active',
        page,
        pageSize
      })
      if (res.ok) {
        setParties(res.data.parties)
        setTotal(res.data.total)
      } else {
        notifications.show({ color: 'red', message: res.error.message })
      }
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [type, query, activeOnly, page])

  useEffect(() => {
    load()
  }, [load])

  // F1 = search, Insert = add (same as Items screen)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'F1') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Insert') {
        e.preventDefault()
        setEditing(null)
        setFormOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const setActive = async (party: Party, active: boolean): Promise<void> => {
    try {
      const res = active
        ? await window.api.parties.reactivate(party.id)
        : await window.api.parties.deactivate(party.id)
      if (res.ok) {
        notifications.show({ color: 'green', message: t(active ? 'parties.reactivated' : 'parties.deactivated') })
        setDeactivating(null)
        load()
      } else {
        notifications.show({ color: 'red', message: res.error.message })
      }
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message })
    }
  }

  const isCustomer = type === 'customer'

  return (
    <div>
      <PageHeader
        title={t('screens.parties.title')}
        subtitle={t('screens.parties.subtitle')}
        actions={
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            {t(isCustomer ? 'parties.addCustomer' : 'parties.addSupplier')}
          </Button>
        }
      />

      <Tabs
        value={type}
        onChange={(v) => {
          setType((v as PartyType) || 'customer')
          setPage(1)
        }}
        mb="md"
      >
        <Tabs.List>
          <Tabs.Tab value="customer">{t('parties.customers')}</Tabs.Tab>
          {isManager && <Tabs.Tab value="supplier">{t('parties.suppliers')}</Tabs.Tab>}
        </Tabs.List>
      </Tabs>

      <Card withBorder shadow="sm" p="md" radius="md" mb="md">
        <Group align="flex-end">
          <TextInput
            ref={searchRef}
            placeholder={t('parties.searchPlaceholder')}
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value)
              setPage(1)
            }}
            style={{ flex: 1 }}
          />
          {isManager && (
            <Select
              data={[
                { value: 'active', label: t('items.activeOnly') },
                { value: 'all', label: t('parties.allStatus') }
              ]}
              value={activeOnly}
              onChange={(v) => {
                setActiveOnly(v || 'active')
                setPage(1)
              }}
              style={{ width: 150 }}
            />
          )}
        </Group>
      </Card>

      <Card withBorder shadow="sm" p="xs" radius="md">
        {loading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : parties.length === 0 ? (
          <Center py="xl">
            <Text fw={600}>{t('parties.none')}</Text>
          </Center>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('parties.name')}</Table.Th>
                <Table.Th>{t('parties.phone')}</Table.Th>
                {isCustomer && <Table.Th>{t('parties.creditLimit')}</Table.Th>}
                <Table.Th>{t('parties.balance')}</Table.Th>
                <Table.Th>{t('items.colStatus')}</Table.Th>
                <Table.Th>{t('items.colActions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {parties.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td fw={600}>{p.name}</Table.Td>
                  <Table.Td>{p.phone || '-'}</Table.Td>
                  {isCustomer && (
                    <Table.Td>{p.creditLimit > 0 ? formatPKR(p.creditLimit) : '-'}</Table.Td>
                  )}
                  <Table.Td>
                    <BalanceText balance={p.balance} />
                  </Table.Td>
                  <Table.Td>
                    <Badge color={p.active ? 'green' : 'gray'} size="sm">
                      {p.active ? t('settings.active') : t('settings.inactive')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label={t(isCustomer ? 'parties.receivePayment' : 'parties.makePayment')}>
                        <ActionIcon variant="subtle" color="teal" onClick={() => setPaying(p)}>
                          <IconCash size={18} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={t('parties.statement')}>
                        <ActionIcon variant="subtle" color="gray" onClick={() => setStatementFor(p)}>
                          <IconFileText size={18} />
                        </ActionIcon>
                      </Tooltip>
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => {
                          setEditing(p)
                          setFormOpen(true)
                        }}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      {isManager &&
                        (p.active ? (
                          <ActionIcon variant="subtle" color="red" onClick={() => setDeactivating(p)}>
                            <IconEyeOff size={16} />
                          </ActionIcon>
                        ) : (
                          <ActionIcon variant="subtle" color="green" onClick={() => setActive(p, true)}>
                            <IconEye size={16} />
                          </ActionIcon>
                        ))}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {total > pageSize && (
          <Group justify="center" p="md">
            <Pagination value={page} onChange={setPage} total={Math.ceil(total / pageSize)} />
          </Group>
        )}
      </Card>

      <PartyFormModal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        type={type}
        party={editing}
        canSetMoney={isManager}
        onSaved={() => {
          setFormOpen(false)
          load()
        }}
      />
      <PaymentModal
        opened={!!paying}
        onClose={() => setPaying(null)}
        party={paying}
        onSaved={() => {
          setPaying(null)
          load()
        }}
      />
      <StatementModal opened={!!statementFor} onClose={() => setStatementFor(null)} party={statementFor} />
      <ConfirmDialog
        opened={!!deactivating}
        title={t('parties.deactivate')}
        message={t('parties.deactivateConfirm', { name: deactivating?.name || '' })}
        confirmLabel={t('parties.deactivate')}
        cancelLabel={t('items.cancel')}
        onConfirm={() => deactivating && setActive(deactivating, false)}
        onCancel={() => setDeactivating(null)}
      />
    </div>
  )
}
