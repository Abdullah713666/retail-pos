import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Card,
  Table,
  Group,
  TextInput,
  Select,
  Button,
  Badge,
  ActionIcon,
  Pagination,
  Text,
  Center,
  Loader
} from '@mantine/core'
import {
  IconSearch,
  IconPlus,
  IconUpload,
  IconEdit,
  IconEyeOff,
  IconEye,
  IconFolder
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/PageHeader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ItemFormModal } from './items/ItemFormModal'
import { CsvImportModal } from './items/CsvImportModal'
import { CategoryModal } from './items/CategoryModal'
import { useAuth } from '../context/AuthContext'
import { formatPKR } from '@shared/money'
import type { Item, Category } from '@shared/types'

export const ItemsScreen: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canModify = user?.role === 'owner' || user?.role === 'manager'

  const searchInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [activeOnly, setActiveOnly] = useState<string>('active')
  const [loading, setLoading] = useState(false)

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [deactivatingItem, setDeactivatingItem] = useState<Item | null>(null)

  const loadCategories = useCallback(async (): Promise<void> => {
    try {
      if (window.api?.categories?.list) {
        const res = await window.api.categories.list()
        if (res.ok) setCategories(res.data)
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  const loadItems = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      if (window.api?.items?.list) {
        const res = await window.api.items.list({
          query: query.trim() || undefined,
          categoryId: selectedCategory ? parseInt(selectedCategory, 10) : undefined,
          activeOnly: activeOnly === 'active',
          page,
          pageSize
        })
        if (res.ok) {
          setItems(res.data.items)
          setTotal(res.data.total)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [query, selectedCategory, activeOnly, page, pageSize])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Global hotkeys (F1 to search, Insert to add)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'F1') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Insert' && canModify) {
        e.preventDefault()
        setEditingItem(null)
        setFormModalOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canModify])

  const handleDeactivate = async (): Promise<void> => {
    if (!deactivatingItem) return
    try {
      const res = await window.api.items.deactivate(deactivatingItem.id)
      if (res.ok) {
        notifications.show({ color: 'green', message: t('items.itemDeactivated') })
        setDeactivatingItem(null)
        loadItems()
      }
    } catch (err) {
      notifications.show({ color: 'red', message: (err as Error).message })
    }
  }

  const handleReactivate = async (item: Item): Promise<void> => {
    try {
      const res = await window.api.items.reactivate(item.id)
      if (res.ok) {
        notifications.show({ color: 'green', message: t('items.itemReactivated') })
        loadItems()
      }
    } catch (err) {
      notifications.show({ color: 'red', message: (err as Error).message })
    }
  }

  const categoryOptions = [
    { value: '', label: t('items.allCategories') },
    ...categories.map((c) => ({ value: String(c.id), label: c.name }))
  ]

  return (
    <div>
      <PageHeader
        title={t('screens.items.title')}
        subtitle={t('screens.items.subtitle')}
        actions={
          canModify ? (
            <Group>
              <Button
                variant="default"
                leftSection={<IconFolder size={16} />}
                onClick={() => setCategoryModalOpen(true)}
              >
                {t('items.categories')}
              </Button>
              <Button
                variant="default"
                leftSection={<IconUpload size={16} />}
                onClick={() => setCsvModalOpen(true)}
              >
                {t('items.importCsv')}
              </Button>
              <Button
                color="blue"
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  setEditingItem(null)
                  setFormModalOpen(true)
                }}
              >
                {t('items.addItem')}
              </Button>
            </Group>
          ) : undefined
        }
      />

      <Card withBorder shadow="sm" p="md" radius="md" mb="md">
        <Group align="flex-end">
          <TextInput
            ref={searchInputRef}
            placeholder={t('items.searchPlaceholder')}
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value)
              setPage(1)
            }}
            style={{ flex: 1 }}
          />
          <Select
            data={categoryOptions}
            value={selectedCategory || ''}
            onChange={(val) => {
              setSelectedCategory(val || null)
              setPage(1)
            }}
            placeholder={t('items.allCategories')}
            style={{ width: 180 }}
          />
          <Select
            data={[
              { value: 'active', label: t('items.activeOnly') },
              { value: 'all', label: t('items.allStatus') }
            ]}
            value={activeOnly}
            onChange={(val) => {
              setActiveOnly(val || 'active')
              setPage(1)
            }}
            style={{ width: 140 }}
          />
        </Group>
      </Card>

      <Card withBorder shadow="sm" p="xs" radius="md">
        {loading ? (
          <Center py="xl">
            <Loader size="md" />
          </Center>
        ) : items.length === 0 ? (
          <Center py="xl">
            <div style={{ textAlign: 'center' }}>
              <Text fw={600} mb="xs">
                {t('items.noItemsFound')}
              </Text>
              <Text size="sm" c="dimmed">
                {t('items.addFirstItem')}
              </Text>
            </div>
          </Center>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('items.colName')}</Table.Th>
                <Table.Th>{t('items.colCategory')}</Table.Th>
                <Table.Th>{t('items.colBarcode')}</Table.Th>
                <Table.Th>{t('items.colBaseUnit')}</Table.Th>
                <Table.Th>{t('items.colSalePrice')}</Table.Th>
                <Table.Th>{t('items.colCostPrice')}</Table.Th>
                <Table.Th>{t('items.colStock')}</Table.Th>
                <Table.Th>{t('items.colUnits')}</Table.Th>
                <Table.Th>{t('items.colStatus')}</Table.Th>
                {canModify && <Table.Th>{t('items.colActions')}</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((it) => (
                <Table.Tr key={it.id}>
                  <Table.Td fw={600}>{it.name}</Table.Td>
                  <Table.Td>{it.categoryName || '-'}</Table.Td>
                  <Table.Td>{it.barcode || '-'}</Table.Td>
                  <Table.Td>{it.baseUnit}</Table.Td>
                  <Table.Td fw={500} c="blue">
                    {formatPKR(it.salePrice)}
                  </Table.Td>
                  <Table.Td c="dimmed">{formatPKR(it.costPrice)}</Table.Td>
                  <Table.Td fw={500}>{it.stockCache}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {it.units.map((u) => (
                        <Badge key={u.id} size="sm" variant="outline">
                          {u.name} ({u.factor})
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={it.active ? 'green' : 'gray'} size="sm">
                      {it.active ? t('settings.active') : t('settings.inactive')}
                    </Badge>
                  </Table.Td>
                  {canModify && (
                    <Table.Td>
                      <Group gap={4}>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => {
                            setEditingItem(it)
                            setFormModalOpen(true)
                          }}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        {it.active ? (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => setDeactivatingItem(it)}
                          >
                            <IconEyeOff size={16} />
                          </ActionIcon>
                        ) : (
                          <ActionIcon
                            variant="subtle"
                            color="green"
                            onClick={() => handleReactivate(it)}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {total > pageSize && (
          <Group justify="center" p="md">
            <Pagination
              value={page}
              onChange={setPage}
              total={Math.ceil(total / pageSize)}
            />
          </Group>
        )}
      </Card>

      <ItemFormModal
        opened={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        item={editingItem}
        categories={categories}
        onSaveSuccess={() => {
          setFormModalOpen(false)
          loadItems()
        }}
        onOpenCategoriesModal={() => setCategoryModalOpen(true)}
      />

      <CsvImportModal
        opened={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImportSuccess={() => {
          loadCategories()
          loadItems()
        }}
      />

      <CategoryModal
        opened={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        categories={categories}
        onCategoryCreated={(newCat) => {
          setCategories((prev) => [...prev, newCat])
        }}
      />

      <ConfirmDialog
        opened={!!deactivatingItem}
        title={t('items.deactivate')}
        message={t('items.deactivateConfirm', { name: deactivatingItem?.name || '' })}
        confirmLabel={t('items.deactivate')}
        cancelLabel={t('items.cancel')}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivatingItem(null)}
      />
    </div>
  )
}
