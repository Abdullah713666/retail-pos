import React, { useEffect, useRef, useState } from 'react'
import { Paper, Text, TextInput, UnstyledButton } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { Item } from '@shared/types'

interface Props {
  onPick: (item: Item, unitName: string | null) => void
  inputRef: React.RefObject<HTMLInputElement>
}

/** Scan a barcode or type a name; arrows + Enter pick a result. */
export const PurchaseItemPicker: React.FC<Props> = ({ onPick, inputRef }) => {
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
        setResults(res.data.filter((i) => i.active === 1 && i.trackStock === 1))
        setActive(0)
      }
    }, 120)
    return () => clearTimeout(timer)
  }, [query])

  const pick = (item: Item, unitName: string | null): void => {
    onPick(item, unitName)
    setQuery('')
    setResults([])
  }

  const onEnter = async (): Promise<void> => {
    const q = query.trim()
    if (!q) return
    const hit = await window.api.items.lookupBarcode(q)
    if (hit.ok && hit.data && hit.data.item.active === 1 && hit.data.item.trackStock === 1) {
      pick(hit.data.item, hit.data.unit?.name ?? null)
    } else if (results[active]) {
      pick(results[active], null)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void onEnter()
    } else if (e.key === 'Escape' && query) {
      e.stopPropagation()
      setQuery('')
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <TextInput
        ref={inputRef}
        data-autofocus
        leftSection={<IconSearch size={16} />}
        placeholder={t('purchases.searchItem')}
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
              onClick={() => pick(it, null)}
            >
              <Text size="sm" fw={500}>{it.name}</Text>
              <Text size="xs" c="dimmed">{it.baseUnit} · {it.barcode || '-'}</Text>
            </UnstyledButton>
          ))}
        </Paper>
      )}
    </div>
  )
}
