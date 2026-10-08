import React, { useState } from 'react'
import {
  Modal,
  FileInput,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  Table,
  Alert,
  Card
} from '@mantine/core'
import { IconUpload, IconCopy, IconCheck, IconAlertTriangle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { formatPKR } from '@shared/money'
import type { CsvPreviewResult } from '@shared/types'

interface CsvImportModalProps {
  opened: boolean
  onClose: () => void
  onImportSuccess: () => void
}

const SAMPLE_CSV = `name,barcode,category,base_unit,sale_price,cost_price,pack_name,pack_factor
Panadol 500mg,10001,Medicines,tablet,3.50,2.80,Box,200
Arinac Forte,10002,Medicines,tablet,8.00,6.50,Box,100
Brufen 400mg,10003,Medicines,tablet,5.00,4.00,Box,100
Disprin,10004,Medicines,tablet,2.00,1.50,Box,300`

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  opened,
  onClose,
  onImportSuccess
}) => {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)

  const handleFileChange = async (selectedFile: File | null): Promise<void> => {
    setFile(selectedFile)
    setPreview(null)
    if (!selectedFile) return

    setAnalyzing(true)
    try {
      const text = await selectedFile.text()
      setCsvText(text)
      const res = await window.api.items.previewCsv(text)
      if (res.ok) {
        setPreview(res.data)
      } else {
        notifications.show({ color: 'red', message: res.error.message })
      }
    } catch (err) {
      notifications.show({ color: 'red', message: (err as Error).message })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleCopySample = (): void => {
    navigator.clipboard.writeText(SAMPLE_CSV)
    notifications.show({
      color: 'teal',
      icon: <IconCheck size={16} />,
      message: t('items.sampleCopied')
    })
  }

  const handleImport = async (): Promise<void> => {
    if (!preview || preview.validRows.length === 0) return

    setImporting(true)
    try {
      const res = await window.api.items.importCsv(csvText)
      if (res.ok) {
        notifications.show({
          color: 'green',
          message: t('items.importSuccess', { count: res.data.importedCount })
        })
        if (res.data.skippedCount > 0) {
          notifications.show({
            color: 'yellow',
            message: t('items.importSkipped', { count: res.data.skippedCount })
          })
        }
        setFile(null)
        setCsvText('')
        setPreview(null)
        onImportSuccess()
        onClose()
      } else {
        notifications.show({ color: 'red', message: res.error.message })
      }
    } catch (err) {
      notifications.show({ color: 'red', message: (err as Error).message })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="lg">{t('items.csvModalTitle')}</Text>}
      size="xl"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t('items.csvInstructions')}
        </Text>

        <Card withBorder p="sm" radius="md">
          <Group justify="space-between">
            <Text size="xs" fw={500} c="dimmed">
              Format: name, barcode, category, base_unit, sale_price, cost_price, pack_name, pack_factor
            </Text>
            <Button
              variant="subtle"
              size="compact-xs"
              leftSection={<IconCopy size={14} />}
              onClick={handleCopySample}
            >
              {t('items.copySampleCsv')}
            </Button>
          </Group>
        </Card>

        <FileInput
          label={t('items.selectCsvFile')}
          placeholder="Upload .csv file"
          leftSection={<IconUpload size={16} />}
          accept=".csv,text/csv"
          value={file}
          onChange={handleFileChange}
        />

        {analyzing && <Text size="sm">{t('items.preview')}...</Text>}

        {preview && (
          <Stack gap="sm">
            <Group>
              <Badge color="blue" size="lg">
                {t('items.totalRows')}: {preview.totalRows}
              </Badge>
              <Badge color="green" size="lg">
                {t('items.validRows')}: {preview.validRows.length}
              </Badge>
              {preview.errors.length > 0 && (
                <Badge color="red" size="lg">
                  {t('items.errorRows')}: {preview.errors.length}
                </Badge>
              )}
            </Group>

            {preview.errors.length > 0 && (
              <Alert
                color="red"
                icon={<IconAlertTriangle size={18} />}
                title={t('items.errorRows')}
              >
                <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t('items.row')}</Table.Th>
                        <Table.Th>{t('items.field')}</Table.Th>
                        <Table.Th>{t('items.issue')}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {preview.errors.map((err, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>{err.rowNumber}</Table.Td>
                          <Table.Td>{err.field || '-'}</Table.Td>
                          <Table.Td>{err.message}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </Alert>
            )}

            {preview.validRows.length > 0 && (
              <div>
                <Text fw={600} size="sm" mb={4}>
                  Preview (showing first {Math.min(preview.validRows.length, 5)} rows)
                </Text>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('items.colName')}</Table.Th>
                      <Table.Th>{t('items.colBarcode')}</Table.Th>
                      <Table.Th>{t('items.colCategory')}</Table.Th>
                      <Table.Th>{t('items.colBaseUnit')}</Table.Th>
                      <Table.Th>{t('items.colSalePrice')}</Table.Th>
                      <Table.Th>{t('items.colUnits')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {preview.validRows.slice(0, 5).map((r, i) => (
                      <Table.Tr key={i}>
                        <Table.Td fw={500}>{r.name}</Table.Td>
                        <Table.Td>{r.barcode || '-'}</Table.Td>
                        <Table.Td>{r.category || '-'}</Table.Td>
                        <Table.Td>{r.baseUnit}</Table.Td>
                        <Table.Td>{formatPKR(r.salePrice)}</Table.Td>
                        <Table.Td>
                          {r.packName ? `${r.packName} (${r.packFactor})` : '-'}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Stack>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            {t('items.cancel')}
          </Button>
          <Button
            color="green"
            onClick={handleImport}
            loading={importing}
            disabled={!preview || preview.validRows.length === 0}
          >
            {t('items.importValid', { count: preview ? preview.validRows.length : 0 })}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
