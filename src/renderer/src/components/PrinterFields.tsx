import React, { useCallback, useEffect, useState } from 'react'
import { Button, Group, Radio, Select, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import type { PaperWidth, PrinterInfo } from '@shared/types'

interface Props {
  printerName: string
  onPrinterName: (v: string) => void
  paperWidth: PaperWidth
  onPaperWidth: (v: PaperWidth) => void
}

/** Printer dropdown (installed Windows printers), paper width and a test-print button. */
export const PrinterFields: React.FC<Props> = ({ printerName, onPrinterName, paperWidth, onPaperWidth }) => {
  const { t } = useTranslation()
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [testing, setTesting] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    const res = await window.api.printing.listPrinters()
    if (res.ok) setPrinters(res.data)
    else notifications.show({ color: 'orange', message: res.error.message })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const names = printers.map((p) => p.name)
  // Keep a saved printer visible even if Windows no longer lists it (switched off / unplugged).
  const data = [
    ...printers.map((p) => ({ value: p.name, label: p.displayName + (p.isDefault ? ` (${t('settings.defaultPrinter')})` : '') })),
    ...(printerName && !names.includes(printerName) ? [{ value: printerName, label: `${printerName} (${t('settings.notFound')})` }] : [])
  ]

  const test = async (): Promise<void> => {
    setTesting(true)
    try {
      const res = await window.api.printing.testPrint({ printerName, paperWidth })
      notifications.show(
        res.ok
          ? { color: 'green', message: t('print.testSent') }
          : { color: 'orange', title: t('print.failedTitle'), message: res.error.message }
      )
    } catch (e) {
      notifications.show({ color: 'orange', title: t('print.failedTitle'), message: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="xs" wrap="nowrap">
        <Select
          style={{ flex: 1 }}
          label={t('wizard.printerName')}
          placeholder={t('settings.choosePrinter')}
          data={data}
          value={printerName || null}
          onChange={(v) => onPrinterName(v ?? '')}
          searchable
          clearable
          nothingFoundMessage={t('settings.noPrinters')}
        />
        <Button variant="default" onClick={() => void load()}>{t('settings.refresh')}</Button>
      </Group>
      <Radio.Group label={t('wizard.paperWidth')} value={paperWidth} onChange={(v) => onPaperWidth(v as PaperWidth)}>
        <Group mt="xs">
          <Radio value="80mm" label="80 mm" />
          <Radio value="58mm" label="58 mm" />
        </Group>
      </Radio.Group>
      <Button variant="outline" onClick={() => void test()} loading={testing} disabled={!printerName} style={{ alignSelf: 'flex-start' }}>
        {t('wizard.testPrint')}
      </Button>
    </Stack>
  )
}
