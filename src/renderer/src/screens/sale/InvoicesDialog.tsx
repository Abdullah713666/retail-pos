import React, { useCallback, useEffect, useState } from 'react'
import { Group, Modal, ScrollArea, Text, TextInput, UnstyledButton } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import type { Sale, SaleSummary } from '@shared/types'
import { InvoiceDetail } from './InvoiceDetail'

interface Props {
  opened: boolean
  onClose: () => void
}

/** F7: find an invoice, then return items or void it. */
export const InvoicesDialog: React.FC<Props> = ({ opened, onClose }) => {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<SaleSummary[]>([])
  const [active, setActive] = useState(0)
  const [sale, setSale] = useState<Sale | null>(null)

  const open = useCallback(async (id: number) => {
    const res = await window.api.sales.get(id)
    if (res.ok) setSale(res.data)
  }, [])

  useEffect(() => {
    if (opened) {
      setQuery('')
      setSale(null)
    }
  }, [opened])

  useEffect(() => {
    if (!opened) return
    const timer = setTimeout(async () => {
      const res = await window.api.sales.list({ query: query.trim() || undefined, limit: 20 })
      if (res.ok) {
        setRows(res.data.filter((r) => r.status !== 'held'))
        setActive(0)
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [opened, query, sale])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && rows[active]) {
      e.preventDefault()
      void open(rows[active].id)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t('sale.invoices')} size="xl" centered>
      <Group align="flex-start" wrap="nowrap" gap="md">
        <div style={{ width: 300 }}>
          <TextInput
            data-autofocus
            placeholder={t('sale.searchInvoice')}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={onKeyDown}
            mb="xs"
          />
          <ScrollArea h={380}>
            {rows.map((r, i) => (
              <UnstyledButton
                key={r.id}
                w="100%"
                px="sm"
                py={6}
                onClick={() => void open(r.id)}
                style={{ background: i === active ? 'var(--mantine-color-blue-light)' : undefined, borderRadius: 4 }}
              >
                <Group justify="space-between">
                  <Text fw={500}>{r.invoiceNo}</Text>
                  <Text fw={700}>{formatPKR(r.total)}</Text>
                </Group>
                <Text size="xs" c={r.status === 'void' ? 'red' : 'dimmed'}>
                  {r.createdAt} · {r.partyName ?? t('sale.walkIn')}{r.status === 'void' ? ` · ${t('sale.isVoid')}` : ''}
                </Text>
              </UnstyledButton>
            ))}
          </ScrollArea>
        </div>
        <div style={{ flex: 1 }}>
          {sale ? (
            <InvoiceDetail
              key={`${sale.id}-${sale.status}-${sale.returnedTotal}`}
              sale={sale}
              onChanged={(id) => void open(id)}
            />
          ) : (
            <Text c="dimmed">{t('sale.pickInvoice')}</Text>
          )}
        </div>
      </Group>
    </Modal>
  )
}
