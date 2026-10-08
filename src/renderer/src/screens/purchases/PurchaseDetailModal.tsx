import React, { useCallback, useEffect, useState } from 'react'
import { Button, Group, Modal, NumberInput, Stack, Table, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import type { PurchaseDetail } from '@shared/types'

interface Props {
  purchaseId: number | null
  onClose: () => void
  onChanged: () => void
}

export const PurchaseDetailModal: React.FC<Props> = ({ purchaseId, onClose, onChanged }) => {
  const { t } = useTranslation()
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null)
  const [returning, setReturning] = useState(false)
  const [qtys, setQtys] = useState<Record<number, number | ''>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    if (purchaseId === null) return
    const res = await window.api.purchases.get(purchaseId)
    if (res.ok) setPurchase(res.data)
    else notifications.show({ color: 'red', message: res.error.message })
  }, [purchaseId])

  useEffect(() => {
    setPurchase(null)
    setReturning(false)
    setQtys({})
    void load()
  }, [load])

  const submitReturn = async (): Promise<void> => {
    if (!purchase || saving) return
    const lines = Object.entries(qtys)
      .filter(([, q]) => typeof q === 'number' && q > 0)
      .map(([id, q]) => ({ purchaseLineId: Number(id), qtyBase: q as number }))
    if (lines.length === 0) return void notifications.show({ color: 'red', message: t('purchases.returnNothing') })
    setSaving(true)
    try {
      const res = await window.api.purchases.return({ purchaseId: purchase.id, lines })
      if (res.ok) {
        notifications.show({ color: 'green', message: t('purchases.returnSaved', { amount: formatPKR(res.data.total) }) })
        setReturning(false)
        setQtys({})
        await load()
        onChanged()
      } else {
        notifications.show({ color: 'red', message: res.error.message })
      }
    } finally {
      setSaving(false)
    }
  }

  const canReturnAny = purchase?.lines.some((l) => l.qtyBase - l.returnedBase > 0) ?? false

  return (
    <Modal
      opened={purchaseId !== null}
      onClose={onClose}
      size="xl"
      title={<Text fw={700}>{t('purchases.detailTitle', { id: purchaseId ?? '' })}</Text>}
    >
      {purchase && (
        <Stack gap="sm">
          <Group justify="space-between">
            <Text>{purchase.supplierName} · {purchase.purchaseDate} · {purchase.billNo || '-'}</Text>
            <Text size="sm">
              {t('purchases.total')}: <b>{formatPKR(purchase.total)}</b> · {t('purchases.colPaid')}: {formatPKR(purchase.paid)}
              {purchase.returnedTotal > 0 && <> · {t('purchases.colReturned')}: {formatPKR(purchase.returnedTotal)}</>}
            </Text>
          </Group>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('purchases.colItem')}</Table.Th>
                <Table.Th>{t('purchases.colQty')}</Table.Th>
                <Table.Th>{t('purchases.colBaseQty')}</Table.Th>
                <Table.Th>{t('purchases.colCost')}</Table.Th>
                <Table.Th>{t('purchases.colLot')}</Table.Th>
                <Table.Th ta="right">{t('purchases.colLineTotal')}</Table.Th>
                <Table.Th>{t('purchases.returnedSoFar')}</Table.Th>
                {returning && <Table.Th w={140}>{t('purchases.returnQty')}</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {purchase.lines.map((l) => {
                const left = l.qtyBase - l.returnedBase
                return (
                  <Table.Tr key={l.id}>
                    <Table.Td>{l.itemName}</Table.Td>
                    <Table.Td>{l.qty} {l.unitName}</Table.Td>
                    <Table.Td>{l.qtyBase} {l.baseUnit}</Table.Td>
                    <Table.Td>{formatPKR(l.unitCost)}</Table.Td>
                    <Table.Td>{l.lotNo ? `${l.lotNo} (${l.expiryDate})` : '-'}</Table.Td>
                    <Table.Td ta="right">{formatPKR(l.lineTotal)}</Table.Td>
                    <Table.Td>{l.returnedBase}</Table.Td>
                    {returning && (
                      <Table.Td>
                        <NumberInput
                          size="xs" min={0} max={left} allowDecimal={false} disabled={left === 0}
                          placeholder={`${t('purchases.canReturn')} ${left}`}
                          value={qtys[l.id] ?? ''}
                          onChange={(v) => setQtys((p) => ({ ...p, [l.id]: typeof v === 'number' ? v : '' }))}
                        />
                      </Table.Td>
                    )}
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
          {purchase.returns.length > 0 && (
            <Text size="sm" c="dimmed">
              {t('purchases.returnsHistory')}: {purchase.returns.map((r) => `${r.createdAt.slice(0, 10)} ${formatPKR(r.total)}`).join(' · ')}
            </Text>
          )}
          <Group justify="flex-end">
            {returning ? (
              <>
                <Button variant="default" onClick={() => setReturning(false)}>{t('purchases.cancel')}</Button>
                <Button color="red" loading={saving} onClick={submitReturn}>{t('purchases.confirmReturn')}</Button>
              </>
            ) : (
              <>
                <Button variant="default" onClick={onClose}>{t('purchases.close')}</Button>
                {canReturnAny && <Button color="red" variant="light" onClick={() => setReturning(true)}>{t('purchases.returnAction')}</Button>}
              </>
            )}
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
