import React, { useEffect, useState } from 'react'
import { Button, Center, Group, Table, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconDownload, IconPrinter } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

export interface ReportCol<R> {
  header: string
  align?: 'right'
  /** What the table shows. */
  render: (row: R) => React.ReactNode
  /** What goes into the CSV (plain number for money, so Excel can add it up). */
  csv: (row: R) => string | number
}

export interface TotalCell {
  text: string
  csv: string | number
}

interface Props<R> {
  /** Heading printed on paper and used as the CSV file name. */
  title: string
  /** e.g. the date range. */
  subtitle?: string
  cols: Array<ReportCol<R>>
  rows: R[]
  /** One entry per column (undefined = empty cell); omit for no totals row. */
  totals?: Array<TotalCell | undefined>
}

/** A report table with Print (window.print) and Export CSV (save dialog in the main process). */
export function ReportTable<R>({ title, subtitle, cols, rows, totals }: Props<R>): React.ReactElement {
  const { t } = useTranslation()
  const [shopName, setShopName] = useState('')

  useEffect(() => {
    window.api.settings.get('shop_name').then((r) => r.ok && setShopName(r.data ?? ''))
  }, [])

  const exportCsv = async (): Promise<void> => {
    const table: Array<Array<string | number>> = [cols.map((c) => c.header)]
    for (const r of rows) table.push(cols.map((c) => c.csv(r)))
    if (totals) table.push(totals.map((c, i) => (c ? c.csv : i === 0 ? t('reports.total') : '')))
    const res = await window.api.reports.saveCsv({ suggestedName: title, rows: table })
    if (!res.ok) {
      notifications.show({ color: 'red', title: t('common.error'), message: res.error.message })
    } else if (res.data.saved) {
      notifications.show({ color: 'teal', title: t('common.success'), message: t('reports.csvSaved', { path: res.data.path }) })
    }
  }

  return (
    <div>
      <Group mb="sm" className="no-print">
        <Button leftSection={<IconPrinter size={16} />} variant="default" onClick={() => window.print()} disabled={rows.length === 0}>
          {t('reports.print')}
        </Button>
        <Button leftSection={<IconDownload size={16} />} variant="default" onClick={exportCsv} disabled={rows.length === 0}>
          {t('reports.exportCsv')}
        </Button>
      </Group>

      {/* Everything inside .print-area is what window.print() outputs (see print.css). */}
      <div className="print-area">
        <Title order={4}>{shopName}</Title>
        <Text fw={600}>{title}</Text>
        {subtitle && <Text size="sm" c="dimmed" mb="xs">{subtitle}</Text>}
        {rows.length === 0 ? (
          <Center py="xl"><Text c="dimmed">{t('reports.none')}</Text></Center>
        ) : (
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                {cols.map((c, i) => (
                  <Table.Th key={i} style={{ textAlign: c.align }}>{c.header}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r, ri) => (
                <Table.Tr key={ri}>
                  {cols.map((c, i) => (
                    <Table.Td key={i} style={{ textAlign: c.align }}>{c.render(r)}</Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
            {totals && (
              <Table.Tfoot>
                <Table.Tr>
                  {totals.map((c, i) => (
                    <Table.Th key={i} style={{ textAlign: cols[i].align }}>
                      {c ? c.text : i === 0 ? t('reports.total') : ''}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        )}
      </div>
    </div>
  )
}
