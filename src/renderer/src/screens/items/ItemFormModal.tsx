import React, { useState, useEffect } from 'react'
import {
  Modal,
  TextInput,
  Select,
  NumberInput,
  Switch,
  Checkbox,
  Button,
  Group,
  Stack,
  SimpleGrid,
  Text,
  ActionIcon,
  Card,
  Divider
} from '@mantine/core'
import { IconPlus, IconTrash, IconBarcode } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { toPaisa, fromPaisa } from '@shared/money'
import type { Category, Item, CreateItemUnitInput } from '@shared/types'
import { useModules } from '../../modules/ModuleContext'

interface UnitDraft {
  name: string
  factor: number
  barcode: string
  salePrice: string
}

interface ItemFormModalProps {
  opened: boolean
  onClose: () => void
  item: Item | null
  categories: Category[]
  onSaveSuccess: (saved: Item) => void
  onOpenCategoriesModal: () => void
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  opened,
  onClose,
  item,
  categories,
  onSaveSuccess,
  onOpenCategoriesModal
}) => {
  const { t } = useTranslation()
  const { activeUiModules } = useModules()

  const [name, setName] = useState('')
  const [aliases, setAliases] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [barcode, setBarcode] = useState('')
  const [baseUnit, setBaseUnit] = useState('pc')
  const [salePrice, setSalePrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [openingStock, setOpeningStock] = useState<number | ''>('')
  const [reorderLevel, setReorderLevel] = useState<number | ''>(0)
  const [trackStock, setTrackStock] = useState(true)
  const [trackLots, setTrackLots] = useState(false)
  const [units, setUnits] = useState<UnitDraft[]>([])
  const [moduleData, setModuleData] = useState<Record<string, Record<string, unknown>>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (item) {
      setName(item.name)
      setAliases('')
      setCategoryId(item.categoryId ? String(item.categoryId) : null)
      setBarcode(item.barcode || '')
      setBaseUnit(item.baseUnit)
      setSalePrice(fromPaisa(item.salePrice).toFixed(2))
      setCostPrice(fromPaisa(item.costPrice).toFixed(2))
      setOpeningStock('')
      setReorderLevel(item.reorderLevel)
      setTrackStock(item.trackStock === 1)
      setTrackLots(item.trackLots === 1)
      setUnits(
        item.units.map((u) => ({
          name: u.name,
          factor: u.factor,
          barcode: u.barcode || '',
          salePrice: u.salePrice != null ? fromPaisa(u.salePrice).toFixed(2) : ''
        }))
      )
    } else {
      setName('')
      setAliases('')
      setCategoryId(null)
      setBarcode('')
      setBaseUnit('pc')
      setSalePrice('')
      setCostPrice('')
      setOpeningStock('')
      setReorderLevel(0)
      setTrackStock(true)
      setTrackLots(activeUiModules.some((m) => m.defaultTrackLots))
      setUnits([])
    }
    setModuleData({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, opened])

  const handleAddUnit = (): void => {
    setUnits((prev) => [...prev, { name: '', factor: 10, barcode: '', salePrice: '' }])
  }

  const handleRemoveUnit = (index: number): void => {
    setUnits((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUnitChange = (index: number, field: keyof UnitDraft, value: string | number): void => {
    setUnits((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleSubmit = async (): Promise<void> => {
    if (!name.trim()) {
      notifications.show({ color: 'red', message: t('common.required') })
      return
    }

    let salePaisa = 0
    let costPaisa = 0
    try {
      salePaisa = toPaisa(salePrice || '0')
      costPaisa = toPaisa(costPrice || '0')
    } catch {
      notifications.show({ color: 'red', message: 'Invalid price amount' })
      return
    }

    // Prepare pack units
    const formattedUnits: CreateItemUnitInput[] = []
    for (const u of units) {
      if (!u.name.trim()) continue
      if (u.factor < 2) {
        notifications.show({ color: 'red', message: 'Pack factor must be at least 2' })
        return
      }
      let uSalePrice: number | null = null
      if (u.salePrice.trim()) {
        try {
          uSalePrice = toPaisa(u.salePrice)
        } catch {
          notifications.show({ color: 'red', message: `Invalid price for pack ${u.name}` })
          return
        }
      }
      formattedUnits.push({
        name: u.name.trim(),
        factor: Number(u.factor),
        barcode: u.barcode.trim() || null,
        salePrice: uSalePrice
      })
    }

    setLoading(true)
    try {
      if (item) {
        const res = await window.api.items.update({
          id: item.id,
          name: name.trim(),
          aliases: aliases.trim() || undefined,
          categoryId: categoryId ? parseInt(categoryId, 10) : null,
          barcode: barcode.trim() || null,
          baseUnit: baseUnit.trim() || 'pc',
          salePrice: salePaisa,
          costPrice: costPaisa,
          reorderLevel: typeof reorderLevel === 'number' ? reorderLevel : 0,
          trackStock,
          trackLots,
          units: formattedUnits,
          moduleData
        })
        if (res.ok) {
          notifications.show({ color: 'green', message: t('items.itemSaved') })
          onSaveSuccess(res.data)
        } else {
          notifications.show({ color: 'red', message: res.error.message })
        }
      } else {
        const res = await window.api.items.create({
          name: name.trim(),
          aliases: aliases.trim() || undefined,
          categoryId: categoryId ? parseInt(categoryId, 10) : null,
          barcode: barcode.trim() || null,
          baseUnit: baseUnit.trim() || 'pc',
          salePrice: salePaisa,
          costPrice: costPaisa,
          reorderLevel: typeof reorderLevel === 'number' ? reorderLevel : 0,
          trackStock,
          trackLots,
          units: formattedUnits,
          moduleData,
          openingStock:
            !trackLots && typeof openingStock === 'number' && openingStock > 0
              ? { qty: openingStock }
              : undefined
        })
        if (res.ok) {
          notifications.show({ color: 'green', message: t('items.itemSaved') })
          onSaveSuccess(res.data)
        } else {
          notifications.show({ color: 'red', message: res.error.message })
        }
      }
    } catch (err) {
      notifications.show({ color: 'red', message: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }

  const categoryOptions = categories.map((c) => ({
    value: String(c.id),
    label: c.name
  }))

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="lg">{item ? t('items.editItem') : t('items.addItem')}</Text>}
      size="lg"
      centered
    >
      <Stack gap="md">
        <Text fw={600} size="sm" c="dimmed">
          {t('items.basicInfo')}
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label={t('items.name')}
            placeholder="e.g. Panadol 500mg"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label={t('items.aliases')}
            placeholder="e.g. paracetamol pain fever"
            value={aliases}
            onChange={(e) => setAliases(e.currentTarget.value)}
          />
          <div>
            <Group justify="space-between" mb={4}>
              <Text size="xs" fw={500}>
                {t('items.category')}
              </Text>
              <Button variant="subtle" size="compact-xs" onClick={onOpenCategoriesModal}>
                {t('items.newCategory')}
              </Button>
            </Group>
            <Select
              data={categoryOptions}
              placeholder={t('items.selectCategory')}
              value={categoryId}
              onChange={setCategoryId}
              clearable
              searchable
            />
          </div>
          <TextInput
            label={t('items.barcode')}
            placeholder="Scan or enter barcode"
            leftSection={<IconBarcode size={16} />}
            value={barcode}
            onChange={(e) => setBarcode(e.currentTarget.value)}
          />
        </SimpleGrid>

        <Divider my="xs" />
        <Text fw={600} size="sm" c="dimmed">
          {t('items.pricingUnits')}
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <TextInput
            label={t('items.baseUnit')}
            placeholder="e.g. tablet, pc, bottle"
            required
            value={baseUnit}
            onChange={(e) => setBaseUnit(e.currentTarget.value)}
          />
          <TextInput
            label={t('items.salePrice')}
            placeholder="0.00"
            required
            value={salePrice}
            onChange={(e) => setSalePrice(e.currentTarget.value)}
          />
          <TextInput
            label={t('items.costPrice')}
            placeholder="0.00"
            required
            value={costPrice}
            onChange={(e) => setCostPrice(e.currentTarget.value)}
          />
          {!item && !trackLots && (
            <NumberInput
              label={t('items.openingStock')}
              placeholder="0"
              min={0}
              value={openingStock}
              onChange={(val) => setOpeningStock(typeof val === 'number' ? val : '')}
            />
          )}
          <NumberInput
            label={t('items.reorderLevel')}
            placeholder="0"
            min={0}
            value={reorderLevel}
            onChange={(val) => setReorderLevel(typeof val === 'number' ? val : '')}
          />
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 22 }}>
            <Switch
              label={t('items.trackStock')}
              checked={trackStock}
              onChange={(e) => setTrackStock(e.currentTarget.checked)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 22 }}>
            <Checkbox
              label={t('items.trackLots')}
              description={t('items.trackLotsHelp')}
              checked={trackLots}
              onChange={(e) => setTrackLots(e.currentTarget.checked)}
            />
          </div>
        </SimpleGrid>

        <Divider my="xs" />
        <Group justify="space-between">
          <Text fw={600} size="sm" c="dimmed">
            {t('items.packUnits')}
          </Text>
          <Button
            variant="light"
            size="compact-sm"
            leftSection={<IconPlus size={14} />}
            onClick={handleAddUnit}
          >
            {t('items.addPack')}
          </Button>
        </Group>

        {units.map((u, idx) => (
          <Card key={idx} withBorder p="xs" radius="sm">
            <Group align="flex-end" grow>
              <TextInput
                label={t('items.packName')}
                placeholder="e.g. Box, Strip"
                value={u.name}
                onChange={(e) => handleUnitChange(idx, 'name', e.currentTarget.value)}
              />
              <NumberInput
                label={t('items.factor')}
                min={2}
                value={u.factor}
                onChange={(val) => handleUnitChange(idx, 'factor', typeof val === 'number' ? val : 2)}
              />
              <TextInput
                label={t('items.packBarcode')}
                placeholder="Barcode"
                value={u.barcode}
                onChange={(e) => handleUnitChange(idx, 'barcode', e.currentTarget.value)}
              />
              <TextInput
                label={t('items.packSalePrice')}
                placeholder="Override price"
                value={u.salePrice}
                onChange={(e) => handleUnitChange(idx, 'salePrice', e.currentTarget.value)}
              />
              <ActionIcon
                color="red"
                variant="subtle"
                mb={4}
                style={{ flexGrow: 0 }}
                onClick={() => handleRemoveUnit(idx)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Group>
          </Card>
        ))}

        {/* UiModules extension fields (e.g. pharmacy item info) */}
        {activeUiModules.map((mod) => {
          if (!mod.itemFormFields) return null
          const ExtField = mod.itemFormFields
          return (
            <ExtField
              key={mod.id}
              itemId={item?.id}
              onChange={(data) => setModuleData((prev) => ({ ...prev, [mod.id]: data }))}
            />
          )
        })}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            {t('items.cancel')}
          </Button>
          <Button color="blue" onClick={handleSubmit} loading={loading}>
            {t('items.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
