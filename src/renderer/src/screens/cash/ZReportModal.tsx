import React, { useEffect, useState } from 'react'
import { Button, Group, Modal, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import type { ZReport } from '@shared/types'
import { callApi } from '../../lib/api'
import { printZReportSafe } from '../../lib/print'
import { ZReportView } from './ZReportView'

interface Props {
  shiftId: number | null
  onClose: () => void
}

export const ZReportModal: React.FC<Props> = ({ shiftId, onClose }) => {
  const { t } = useTranslation()
  const [z, setZ] = useState<ZReport | null>(null)

  useEffect(() => {
    setZ(null)
    if (shiftId === null) return
    void callApi(() => window.api.cash.zReport(shiftId)).then(setZ)
  }, [shiftId])

  return (
    <Modal opened={shiftId !== null} onClose={onClose} title={t('cash.zTitle')} centered size="md">
      {z ? <ZReportView z={z} /> : <Text c="dimmed">...</Text>}
      <Group mt="md" justify="flex-end" className="no-print">
        <Button variant="default" disabled={!z} onClick={() => window.print()}>{t('cash.printPage')}</Button>
        <Button disabled={!z} onClick={() => shiftId !== null && void printZReportSafe(shiftId)}>{t('cash.printReceipt')}</Button>
        <Button variant="subtle" onClick={onClose}>{t('common.close')}</Button>
      </Group>
    </Modal>
  )
}
