import React, { useCallback, useEffect, useState } from 'react'
import { Button, Group, Modal, Text, UnstyledButton } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import type { SaleSummary } from '@shared/types'

interface Props {
  opened: boolean
  onClose: () => void
  onRecall: (id: number) => void
  onChanged: () => void
}

/** F6: arrows choose, Enter recalls, Delete discards the draft (asks first). */
export const HeldDialog: React.FC<Props> = ({ opened, onClose, onRecall, onChanged }) => {
  const { t } = useTranslation()
  const [rows, setRows] = useState<SaleSummary[]>([])
  const [active, setActive] = useState(0)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const load = useCallback(async () => {
    const res = await window.api.sales.list({ status: 'held', limit: 50 })
    if (res.ok) setRows(res.data)
  }, [])

  useEffect(() => {
    if (opened) {
      setActive(0)
      setConfirmId(null)
      void load()
    }
  }, [opened, load])

  const discard = async (id: number): Promise<void> => {
    await window.api.sales.discardHeld(id)
    setConfirmId(null)
    await load()
    onChanged()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (confirmId !== null) {
      if (e.key === 'Enter') {
        e.preventDefault()
        void discard(confirmId)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && rows[active]) {
      e.preventDefault()
      onRecall(rows[active].id)
    } else if (e.key === 'Delete' && rows[active]) {
      e.preventDefault()
      setConfirmId(rows[active].id)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t('sale.heldBills')} centered>
      <div tabIndex={0} data-autofocus onKeyDown={onKeyDown} style={{ outline: 'none' }}>
        {rows.length === 0 && <Text c="dimmed">{t('sale.noHeld')}</Text>}
        {rows.map((r, i) => (
          <UnstyledButton
            key={r.id}
            w="100%"
            px="sm"
            py={6}
            onMouseEnter={() => setActive(i)}
            onClick={() => onRecall(r.id)}
            style={{ background: i === active ? 'var(--mantine-color-blue-light)' : undefined, borderRadius: 4 }}
          >
            <Group justify="space-between">
              <Text fw={500}>#{r.id} · {r.partyName ?? t('sale.walkIn')}</Text>
              <Text fw={700}>{formatPKR(r.total)}</Text>
            </Group>
            <Text size="xs" c="dimmed">{r.createdAt} · {t('sale.linesN', { n: r.lineCount })}</Text>
          </UnstyledButton>
        ))}
        {confirmId !== null ? (
          <Group mt="md" justify="space-between">
            <Text c="red" size="sm">{t('sale.discardAsk')}</Text>
            <Group gap="xs">
              <Button size="xs" variant="default" onClick={() => setConfirmId(null)}>{t('sale.cancel')}</Button>
              <Button size="xs" color="red" onClick={() => void discard(confirmId)}>{t('sale.discard')} (Enter)</Button>
            </Group>
          </Group>
        ) : (
          <Text size="xs" c="dimmed" mt="md">{t('sale.heldHint')}</Text>
        )}
      </div>
    </Modal>
  )
}
