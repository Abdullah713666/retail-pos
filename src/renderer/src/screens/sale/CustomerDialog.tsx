import React, { useEffect, useRef, useState } from 'react'
import { Modal, Text, TextInput, UnstyledButton } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import type { Party } from '@shared/types'

interface Props {
  opened: boolean
  onClose: () => void
  onPick: (c: Party | null) => void
}

/** F3: type to search, arrows + Enter pick. The first row is always "walk-in" (no customer). */
export const CustomerDialog: React.FC<Props> = ({ opened, onClose, onPick }) => {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Party[]>([])
  const [active, setActive] = useState(0)
  const seq = useRef(0)

  useEffect(() => {
    if (opened) {
      setQuery('')
      setActive(0)
    }
  }, [opened])

  useEffect(() => {
    if (!opened) return
    const mine = ++seq.current
    const timer = setTimeout(async () => {
      const res = await window.api.parties.list({ type: 'customer', activeOnly: true, query: query.trim() || undefined, pageSize: 8 })
      if (mine === seq.current && res.ok) {
        setRows(res.data.parties)
        setActive(0)
      }
    }, 120)
    return () => clearTimeout(timer)
  }, [opened, query])

  const options: Array<Party | null> = [null, ...rows]
  const pick = (c: Party | null): void => {
    onPick(c)
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(options[active] ?? null)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t('sale.chooseCustomer')} centered>
      <TextInput
        data-autofocus
        size="md"
        placeholder={t('sale.searchCustomer')}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        mb="xs"
      />
      {options.map((c, i) => (
        <UnstyledButton
          key={c?.id ?? 'walkin'}
          w="100%"
          px="sm"
          py={6}
          onMouseEnter={() => setActive(i)}
          onClick={() => pick(c)}
          style={{ background: i === active ? 'var(--mantine-color-blue-light)' : undefined, borderRadius: 4 }}
        >
          <Text fw={500}>{c ? c.name : t('sale.walkIn')}</Text>
          {c && (
            <Text size="xs" c="dimmed">
              {c.phone || '-'} · {t('sale.owes')} {formatPKR(Math.max(c.balance, 0))}
              {c.creditLimit > 0 ? ` · ${t('sale.limit')} ${formatPKR(c.creditLimit)}` : ''}
            </Text>
          )}
        </UnstyledButton>
      ))}
    </Modal>
  )
}
