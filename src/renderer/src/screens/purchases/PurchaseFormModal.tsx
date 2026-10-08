import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActionIcon, Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Table, Text, TextInput
} from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { formatPKR, fromPaisa, multiplyPrice, toPaisa } from '@shared/money'
import type { Item, Party, PurchaseLineInput } from '@shared/types'
import { PurchaseItemPicker } from './PurchaseItemPicker'

interface Draft {
  key: number
  item: Item
  unitName: string
  qty: number | ''
  cost: string // rupees text
  lotNo: string
  expiry: string
}

interface Props {
  opened: boolean
  onClose: () => void
  onSaved: () => void
}

const today = (): string => new Date().toLocaleDateString('en-CA')

function factorOf(item: Item, unitName: string): number {
  return item.units.find((u) => u.name === unitName)?.factor ?? 1
}

function paisaOrNull(text: string): number | null {
  try {
    return toPaisa(text || '0')
  } catch {
    return null
  }
}

export const PurchaseFormModal: React.FC<Props> = ({ opened, onClose, onSaved }) => {
  const { t } = useTranslation()
  const pickerRef = useRef<HTMLInputElement>(null)
  const keySeq = useRef(0)
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [billNo, setBillNo] = useState('')
  const [date, setDate] = useState(today())
  const [lines, setLines] = useState<Draft[]>([])
  const [discount, setDiscount] = useState('')
  const [paid, setPaid] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!opened) return
    setSupplierId(null)
    setBillNo('')
    setDate(today())
    setLines([])
    setDiscount('')
    setPaid('')
    void window.api.parties.list({ type: 'supplier', activeOnly: true, pageSize: 200 }).then((r) => {
      if (r.ok) setSuppliers(r.data.parties)
    })
  }, [opened])

  const addItem = useCallback((item: Item, unitName: string | null): void => {
    const unit = unitName ?? item.baseUnit
    setLines((prev) => [
      ...prev,
      {
        key: ++keySeq.current, item, unitName: unit, qty: 1,
        cost: fromPaisa(item.costPrice * factorOf(item, unit)).toFixed(2),
        lotNo: '', expiry: ''
      }
    ])
  }, [])

  const patch = (key: number, p: Partial<Draft>): void =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...p } : l)))

  const lineTotal = (l: Draft): number | null => {
    const c = paisaOrNull(l.cost)
    return c === null || l.qty === '' ? null : multiplyPrice(c, l.qty)
  }
  // Preview only: main recomputes everything on save.
  const subtotal = lines.reduce((s, l) => s + (lineTotal(l) ?? 0), 0)
  const discountPaisa = paisaOrNull(discount)
  const total = subtotal - (discountPaisa ?? 0)
  const paidPaisa = paisaOrNull(paid)

  const handleSave = async (): Promise<void> => {
    if (saving) return
    if (!supplierId) return void notifications.show({ color: 'red', message: t('purchases.chooseSupplier') })
    if (lines.length === 0) return void notifications.show({ color: 'red', message: t('purchases.addLines') })
    if (discountPaisa === null || paidPaisa === null) {
      return void notifications.show({ color: 'red', message: t('purchases.invalidAmount') })
    }
    const payload: PurchaseLineInput[] = []
    for (const l of lines) {
      const cost = paisaOrNull(l.cost)
      if (cost === null || l.qty === '' || l.qty <= 0) {
        return void notifications.show({ color: 'red', message: t('purchases.invalidAmount') })
      }
      if (l.item.trackLots === 1 && (!l.lotNo.trim() || !l.expiry)) {
        return void notifications.show({ color: 'red', message: t('purchases.lotMissing', { name: l.item.name }) })
      }
      payload.push({
        itemId: l.item.id,
        unitName: l.unitName,
        qty: l.qty,
        unitCost: cost,
        lotNo: l.item.trackLots === 1 ? l.lotNo.trim() : null,
        expiryDate: l.item.trackLots === 1 ? l.expiry : null
      })
    }
    setSaving(true)
    try {
      const res = await window.api.purchases.create({
        supplierId: Number(supplierId),
        billNo: billNo.trim() || null,
        date,
        lines: payload,
        discount: discountPaisa,
        paid: paidPaisa
      })
      if (res.ok) {
        notifications.show({ color: 'green', message: t('purchases.saved') })
        onSaved()
      } else {
        notifications.show({ color: 'red', message: res.error.message })
      }
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="95%"
      closeOnClickOutside={false}
      title={<Text fw={700} size="lg">{t('purchases.new')}</Text>}
    >
      <Stack
        gap="sm"
        onKeyDown={(e) => {
          if (e.key === 'F1') {
            e.preventDefault()
            pickerRef.current?.focus()
          } else if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault()
            void handleSave()
          }
        }}
      >
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Select
            label={t('purchases.supplier')}
            placeholder={t('purchases.selectSupplier')}
            searchable
            data={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
            value={supplierId}
            onChange={setSupplierId}
          />
          <TextInput label={t('purchases.billNo')} value={billNo} onChange={(e) => setBillNo(e.currentTarget.value)} />
          <TextInput label={t('purchases.date')} type="date" max={today()} value={date} onChange={(e) => setDate(e.currentTarget.value)} />
        </SimpleGrid>

        <PurchaseItemPicker inputRef={pickerRef} onPick={addItem} />

        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('purchases.colItem')}</Table.Th>
              <Table.Th>{t('purchases.colUnit')}</Table.Th>
              <Table.Th w={100}>{t('purchases.colQty')}</Table.Th>
              <Table.Th w={120}>{t('purchases.colCost')}</Table.Th>
              <Table.Th>{t('purchases.colLot')}</Table.Th>
              <Table.Th>{t('purchases.colExpiry')}</Table.Th>
              <Table.Th ta="right">{t('purchases.colLineTotal')}</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lines.map((l) => {
              const lt = lineTotal(l)
              const lots = l.item.trackLots === 1
              return (
                <Table.Tr key={l.key}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{l.item.name}</Text>
                    {l.qty !== '' && (
                      <Text size="xs" c="dimmed">
                        = {l.qty * factorOf(l.item, l.unitName)} {l.item.baseUnit}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      w={110}
                      allowDeselect={false}
                      data={[l.item.baseUnit, ...l.item.units.map((u) => u.name)]}
                      value={l.unitName}
                      onChange={(v) =>
                        v && patch(l.key, { unitName: v, cost: fromPaisa(l.item.costPrice * factorOf(l.item, v)).toFixed(2) })
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput size="xs" min={1} allowDecimal={false} value={l.qty}
                      onChange={(v) => patch(l.key, { qty: typeof v === 'number' ? v : '' })} />
                  </Table.Td>
                  <Table.Td>
                    <TextInput size="xs" value={l.cost} onChange={(e) => patch(l.key, { cost: e.currentTarget.value })} />
                  </Table.Td>
                  <Table.Td>
                    {lots && <TextInput size="xs" value={l.lotNo} onChange={(e) => patch(l.key, { lotNo: e.currentTarget.value })} />}
                  </Table.Td>
                  <Table.Td>
                    {lots && <TextInput size="xs" type="date" value={l.expiry} onChange={(e) => patch(l.key, { expiry: e.currentTarget.value })} />}
                  </Table.Td>
                  <Table.Td ta="right">{lt === null ? '-' : formatPKR(lt)}</Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="red" aria-label={t('purchases.remove')}
                      onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>

        <Group justify="flex-end" align="flex-end" gap="lg">
          <Stack gap={2} align="flex-end">
            <Text size="sm">{t('purchases.subtotal')}: {formatPKR(subtotal)}</Text>
            <Text fw={700}>{t('purchases.total')}: {formatPKR(total)}</Text>
            {paidPaisa !== null && (
              <Text size="xs" c="dimmed">{t('purchases.dueToSupplier')}: {formatPKR(total - paidPaisa)}</Text>
            )}
          </Stack>
          <TextInput label={t('purchases.discount')} w={120} placeholder="0.00" value={discount} onChange={(e) => setDiscount(e.currentTarget.value)} />
          <TextInput label={t('purchases.paidNow')} w={140} placeholder="0.00" value={paid} onChange={(e) => setPaid(e.currentTarget.value)}
            rightSectionWidth={72}
            rightSection={<Button size="compact-xs" variant="subtle" onClick={() => setPaid(fromPaisa(Math.max(total, 0)).toFixed(2))}>{t('purchases.payFull')}</Button>} />
        </Group>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>{t('purchases.cancel')}</Button>
          <Button onClick={handleSave} loading={saving}>{t('purchases.save')}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
