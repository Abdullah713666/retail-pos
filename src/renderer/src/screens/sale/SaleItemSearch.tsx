import React, { useEffect, useRef, useState } from 'react'
import { Paper, Text, TextInput, UnstyledButton } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import type { Item, ItemUnit } from '@shared/types'

interface Props {
  inputRef: React.RefObject<HTMLInputElement>
  onAdd: (item: Item, unit: ItemUnit | null) => void
  /** Keys pressed while the box is empty drive the line grid. */
  onMoveLine: (delta: number) => void
  onQty: (delta: number) => void
  onRemove: () => void
  onEmptyEnter: () => void
  onEmptyEscape: () => void
}

/** F1 box. Enter on an exact barcode adds that item (pack barcode adds the pack unit). */
export const SaleItemSearch: React.FC<Props> = ({
  inputRef, onAdd, onMoveLine, onQty, onRemove, onEmptyEnter, onEmptyEscape
}) => {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Item[]>([])
  const [active, setActive] = useState(0)
  const seq = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    const mine = ++seq.current
    const timer = setTimeout(async () => {
      const res = await window.api.items.search(q, 8)
      if (mine === seq.current && res.ok) {
        setResults(res.data)
        setActive(0)
      }
    }, 120)
    return () => clearTimeout(timer)
  }, [query])

  const reset = (): void => {
    setQuery('')
    setResults([])
  }

  const onEnter = async (): Promise<void> => {
    const q = query.trim()
    if (!q) {
      onEmptyEnter()
      return
    }
    const hit = await window.api.items.lookupBarcode(q)
    if (hit.ok && hit.data) {
      onAdd(hit.data.item, hit.data.unit ?? null)
      reset()
    } else if (results[active]) {
      onAdd(results[active], null)
      reset()
    } else {
      notifications.show({ color: 'orange', message: t('sale.notFound', { q }) })
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const empty = query.trim() === ''
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const d = e.key === 'ArrowDown' ? 1 : -1
      if (empty) onMoveLine(d)
      else setActive((a) => Math.min(Math.max(a + d, 0), Math.max(results.length - 1, 0)))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void onEnter()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (empty) onEmptyEscape()
      else reset()
    } else if (empty && (e.key === '+' || e.key === '-')) {
      e.preventDefault()
      onQty(e.key === '+' ? 1 : -1)
    } else if (empty && e.key === 'Delete') {
      e.preventDefault()
      onRemove()
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <TextInput
        ref={inputRef}
        size="md"
        data-autofocus
        leftSection={<IconSearch size={18} />}
        placeholder={t('sale.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
      {query.trim() && results.length > 0 && (
        <Paper withBorder shadow="md" style={{ position: 'absolute', zIndex: 300, left: 0, right: 0, top: '100%' }}>
          {results.map((it, idx) => (
            <UnstyledButton
              key={it.id}
              w="100%"
              px="sm"
              py={6}
              style={{ background: idx === active ? 'var(--mantine-color-blue-light)' : undefined }}
              onMouseEnter={() => setActive(idx)}
              onClick={() => {
                onAdd(it, null)
                reset()
                inputRef.current?.focus()
              }}
            >
              <Text size="sm" fw={500}>
                {it.name}{' '}
                <Text span size="sm" c="dimmed">
                  {formatPKR(it.salePrice)} / {it.baseUnit}
                </Text>
              </Text>
              <Text size="xs" c={it.trackStock && it.stockCache <= 0 ? 'red' : 'dimmed'}>
                {it.trackStock ? t('sale.inStock', { n: it.stockCache }) : t('sale.noStockTracking')}
                {it.barcode ? ` · ${it.barcode}` : ''}
              </Text>
            </UnstyledButton>
          ))}
        </Paper>
      )}
    </div>
  )
}
