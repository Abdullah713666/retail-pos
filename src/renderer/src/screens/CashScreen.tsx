import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Group, SegmentedControl, Stack, Table, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import type { CashEntryType, Shift, ShiftDetail } from '@shared/types'
import { callApi } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { moneyText, parseMoney } from './sale/moneyText'
import { OpenShiftDialog } from './cash/OpenShiftDialog'
import { ZReportModal } from './cash/ZReportModal'

const Line: React.FC<{ label: string; value: number; sign?: string; bold?: boolean }> = ({ label, value, sign = '', bold }) => (
  <Group justify="space-between">
    <Text fw={bold ? 700 : 400}>{sign} {label}</Text>
    <Text fw={bold ? 700 : 400}>{formatPKR(value)}</Text>
  </Group>
)

export const CashScreen: React.FC = () => {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<ShiftDetail | null>(null)
  const [history, setHistory] = useState<Shift[]>([])
  const [loaded, setLoaded] = useState(false)
  const [openDlg, setOpenDlg] = useState(false)
  const [zFor, setZFor] = useState<number | null>(null)
  const [type, setType] = useState<CashEntryType>('expense')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [counted, setCounted] = useState('')
  const [closeNote, setCloseNote] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const cur = await callApi(() => window.api.cash.current())
    if (cur) {
      const d = await callApi(() => window.api.cash.detail(cur.id))
      setDetail(d)
      setCounted((c) => c || moneyText(d?.cash.expectedCash ?? 0))
    } else {
      setDetail(null)
    }
    const list = await callApi(() => window.api.cash.list(15))
    setHistory((list ?? []).filter((s) => s.closedAt))
    setLoaded(true)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addEntry = async (): Promise<void> => {
    const a = parseMoney(amount)
    if (!detail || a === null || a <= 0) return
    setBusy(true)
    const res = await callApi(() => window.api.cash.addEntry({ shiftId: detail.shift.id, type, amount: a, note }))
    setBusy(false)
    if (res) {
      setAmount('')
      setNote('')
      setCounted('')
      void refresh()
    }
  }

  const close = async (): Promise<void> => {
    const c = parseMoney(counted)
    if (!detail || c === null) return
    setBusy(true)
    const res = await callApi(() => window.api.cash.close({ shiftId: detail.shift.id, countedCash: c, note: closeNote }))
    setBusy(false)
    if (res) {
      notifications.show({ color: 'green', message: t('cash.closedOk') })
      setCounted('')
      setCloseNote('')
      void refresh()
      setZFor(res.shift.id)
    }
  }

  const countedN = parseMoney(counted)
  const diff = detail && countedN !== null ? countedN - detail.cash.expectedCash : null
  const amountN = parseMoney(amount)

  return (
    <div>
      <PageHeader title={t('screens.cash.title')} subtitle={t('screens.cash.subtitle')} />
      <Stack gap="md">
        {loaded && !detail && (
          <Alert color="orange" title={t('cash.noShift')}>
            <Group justify="space-between">
              <Text size="sm">{t('cash.noShiftHint')}</Text>
              <Button onClick={() => setOpenDlg(true)}>{t('cash.openShift')}</Button>
            </Group>
          </Alert>
        )}

        {detail && (
          <Group align="flex-start" grow>
            <Card withBorder p="lg" radius="md">
              <Stack gap={6}>
                <Text fw={700}>{t('cash.shiftNo', { id: detail.shift.id })} · {detail.shift.userName} · {detail.shift.openedAt}</Text>
                <Line label={t('cash.openingCash')} value={detail.cash.openingCash} />
                <Line label={t('cash.cashSales')} value={detail.cash.cashSales} sign="+" />
                <Line label={t('cash.cashRefunds')} value={detail.cash.cashRefunds} sign="-" />
                <Line label={t('cash.in')} value={detail.cash.cashIn} sign="+" />
                <Line label={t('cash.out')} value={detail.cash.cashOut} sign="-" />
                <Line label={t('cash.expense')} value={detail.cash.expenses} sign="-" />
                <Line label={t('cash.supplierPaid')} value={detail.cash.supplierPaid} sign="-" />
                <Line label={t('cash.customerPaid')} value={detail.cash.customerPaid} sign="+" />
                <Line label={t('cash.expected')} value={detail.cash.expectedCash} bold />
                <Button variant="light" onClick={() => setZFor(detail.shift.id)}>{t('cash.viewX')}</Button>
              </Stack>
            </Card>

            <Card withBorder p="lg" radius="md">
              <Stack gap="xs">
                <Text fw={700}>{t('cash.addEntry')}</Text>
                <SegmentedControl
                  value={type}
                  onChange={(v) => setType(v as CashEntryType)}
                  data={[
                    { value: 'expense', label: t('cash.expense') },
                    { value: 'out', label: t('cash.out') },
                    { value: 'in', label: t('cash.in') }
                  ]}
                />
                <TextInput label={t('cash.amount')} value={amount} onChange={(e) => setAmount(e.currentTarget.value)} error={amountN === null ? t('sale.badAmount') : undefined} />
                <TextInput label={t('cash.note')} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
                <Button onClick={() => void addEntry()} loading={busy} disabled={!amountN || (type !== 'in' && !note.trim())}>
                  {t('cash.save')}
                </Button>
                {detail.entries.length > 0 && (
                  <Table verticalSpacing={2} mt="xs">
                    <Table.Tbody>
                      {detail.entries.map((e) => (
                        <Table.Tr key={e.id}>
                          <Table.Td>{t(`cash.${e.type}`)}</Table.Td>
                          <Table.Td>{e.note}</Table.Td>
                          <Table.Td ta="right">{formatPKR(e.amount)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Stack>
            </Card>

            <Card withBorder p="lg" radius="md">
              <Stack gap="xs">
                <Text fw={700}>{t('cash.closeShift')}</Text>
                <Line label={t('cash.expected')} value={detail.cash.expectedCash} />
                <TextInput label={t('cash.counted')} value={counted} onChange={(e) => setCounted(e.currentTarget.value)} onFocus={(e) => e.currentTarget.select()} error={countedN === null ? t('sale.badAmount') : undefined} />
                {diff !== null && (
                  <Group justify="space-between">
                    <Text fw={700}>{t('cash.difference')}</Text>
                    <Text fw={700} c={diff === 0 ? 'green' : 'red'}>{formatPKR(diff)}</Text>
                  </Group>
                )}
                <TextInput label={t('cash.note')} value={closeNote} onChange={(e) => setCloseNote(e.currentTarget.value)} />
                <Button color="red" onClick={() => void close()} loading={busy} disabled={countedN === null}>{t('cash.closeShift')}</Button>
              </Stack>
            </Card>
          </Group>
        )}

        {history.length > 0 && (
          <Card withBorder p="lg" radius="md">
            <Text fw={700} mb="xs">{t('cash.history')}</Text>
            <Table verticalSpacing={4}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th><Table.Th>{t('cash.opened')}</Table.Th><Table.Th>{t('cash.closed')}</Table.Th>
                  <Table.Th ta="right">{t('cash.expected')}</Table.Th><Table.Th ta="right">{t('cash.counted')}</Table.Th>
                  <Table.Th ta="right">{t('cash.difference')}</Table.Th><Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {history.map((s) => (
                  <Table.Tr key={s.id}>
                    <Table.Td>{s.id}</Table.Td><Table.Td>{s.openedAt}</Table.Td><Table.Td>{s.closedAt}</Table.Td>
                    <Table.Td ta="right">{formatPKR(s.expectedCash ?? 0)}</Table.Td>
                    <Table.Td ta="right">{formatPKR(s.countedCash ?? 0)}</Table.Td>
                    <Table.Td ta="right" c={s.difference === 0 ? 'green' : 'red'}>{formatPKR(s.difference ?? 0)}</Table.Td>
                    <Table.Td><Button size="compact-xs" variant="light" onClick={() => setZFor(s.id)}>{t('cash.zTitle')}</Button></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        )}
      </Stack>
      <OpenShiftDialog opened={openDlg} onClose={() => setOpenDlg(false)} onOpened={() => void refresh()} />
      <ZReportModal shiftId={zFor} onClose={() => setZFor(null)} />
    </div>
  )
}
