import React, { useState } from 'react'
import { Modal, TextInput, Button, Group, Stack, Table, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import type { Category } from '@shared/types'

interface CategoryModalProps {
  opened: boolean
  onClose: () => void
  categories: Category[]
  onCategoryCreated: (category: Category) => void
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  opened,
  onClose,
  categories,
  onCategoryCreated
}) => {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return

    setLoading(true)
    try {
      const res = await window.api.categories.create(trimmed)
      if (res.ok) {
        notifications.show({
          color: 'green',
          message: t('items.categoryCreated')
        })
        setName('')
        onCategoryCreated(res.data)
      } else {
        notifications.show({
          color: 'red',
          message: res.error.message
        })
      }
    } catch (err) {
      notifications.show({
        color: 'red',
        message: (err as Error).message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={600}>{t('items.manageCategories')}</Text>}
      size="md"
      centered
    >
      <Stack gap="md">
        <Group align="flex-end">
          <TextInput
            style={{ flex: 1 }}
            label={t('items.categoryName')}
            placeholder={t('items.categoryName')}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
          />
          <Button onClick={handleCreate} loading={loading} disabled={!name.trim()}>
            {t('items.addCategory')}
          </Button>
        </Group>

        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>{t('items.colName')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {categories.map((c, idx) => (
                <Table.Tr key={c.id}>
                  <Table.Td>{idx + 1}</Table.Td>
                  <Table.Td fw={500}>{c.name}</Table.Td>
                </Table.Tr>
              ))}
              {categories.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={2} style={{ textAlign: 'center' }}>
                    <Text size="sm" c="dimmed">
                      {t('items.noItemsFound')}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.close')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
