import React, { useCallback, useEffect, useState } from 'react'
import { Modal, TextInput, Button, Group, Table, Text, Title, Center, Loader } from '@mantine/core'
import { IconPrinter } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import type { Party, Statement } from '@shared/types'
import { BalanceText } from './BalanceText'

interface Props {
  opened: boolean
  onClose: () => void
  party: Party | null
}

export const StatementModal: React.FC<Props> = ({ opened, onClose, party }) => {
  const { t } = useTranslation()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [shopName, setShopName] = useState('')
  const [statement, setStatement] = useState<Statement | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    if (!party) return
    setLoading(true)
    try {
      const res = await window.api.ledger.statement({
        partyId: party.id,
        from: from || undefined,
        to: to || undefined
      })
      if (res.ok) setStatement(res.data)
      else notifications.show({ color: 'red', message: res.error.message })
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [party, from, to])

  useEffect(() => {
    if (opened) {
      setFrom('')
      setTo('')
      setStatement(null)
      window.api.settings.get('shop_name').then((r) => r.ok && setShopName(r.data ?? ''))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, party?.id])

  useEffect(() => {
    if (opened) load()
  }, [opened, load])

  if (!party) return null

  return (
    <Modal opened={opened} onClose={onClose} size="xl" centered title={<Text fw={600}>{t('parties.statement')}</Text>}>
      <Group align="flex-end" mb="md" className="no-print">
        <TextInput type="date" label={t('parties.from')} value={from} onChange={(e) => setFrom(e.currentTarget.value)} />
        <TextInput type="date" label={t('parties.to')} value={to} onChange={(e) => setTo(e.currentTarget.value)} />
        <Button leftSection={<IconPrinter size={16} />} onClick={() => window.print()} disabled={!statement}>
          {t('parties.print')}
        </Button>
      </Group>

      {/* Everything inside .print-area is what window.print() outputs (see print.css). */}
      <div className="print-area">
        {loading && !statement ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : statement ? (
          <>
            <Title order={3}>{shopName}</Title>
            <Text fw={600}>
              {t('parties.statementOf')} {party.name}
              {party.phone ? ` (${party.phone})` : ''}
            </Text>
            <Text size="sm" c="dimmed" mb="sm">
              {statement.from || t('parties.beginning')} - {statement.to || t('parties.today')}
            </Text>
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('parties.colDate')}</Table.Th>
                  <Table.Th>{t('parties.colType')}</Table.Th>
                  <Table.Th>{t('parties.note')}</Table.Th>
                  <Table.Th ta="right">{t('parties.colDebit')}</Table.Th>
                  <Table.Th ta="right">{t('parties.colCredit')}</Table.Th>
                  <Table.Th ta="right">{t('parties.colBalance')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td colSpan={5} fw={600}>
                    {t('parties.openingBalanceRow')}
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {formatPKR(statement.openingBalance)}
                  </Table.Td>
                </Table.Tr>
                {statement.entries.map((e) => (
                  <Table.Tr key={e.id}>
                    <Table.Td>{e.createdAt.slice(0, 16)}</Table.Td>
                    <Table.Td>{t(`parties.entryType.${e.type}`)}</Table.Td>
                    <Table.Td>{e.note || ''}</Table.Td>
                    <Table.Td ta="right">{e.debit ? formatPKR(e.debit) : ''}</Table.Td>
                    <Table.Td ta="right">{e.credit ? formatPKR(e.credit) : ''}</Table.Td>
                    <Table.Td ta="right">{formatPKR(e.balance)}</Table.Td>
                  </Table.Tr>
                ))}
                <Table.Tr>
                  <Table.Td colSpan={3} fw={700}>
                    {t('parties.totals')}
                  </Table.Td>
                  <Table.Td ta="right" fw={700}>
                    {formatPKR(statement.totalDebit)}
                  </Table.Td>
                  <Table.Td ta="right" fw={700}>
                    {formatPKR(statement.totalCredit)}
                  </Table.Td>
                  <Table.Td ta="right" fw={700}>
                    {formatPKR(statement.closingBalance)}
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
            <Group justify="flex-end" mt="sm">
              <Text fw={600}>{t('parties.closingBalance')}:</Text>
              <BalanceText balance={statement.closingBalance} fw={700} />
            </Group>
            <Text size="xs" c="dimmed" mt="xs">
              {t('parties.signNote')}
            </Text>
          </>
        ) : null}
      </div>
    </Modal>
  )
}
