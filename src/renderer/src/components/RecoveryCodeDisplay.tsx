import React from 'react'
import { Stack, Text, Button, Checkbox, Alert, Code } from '@mantine/core'
import { IconPrinter } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

// Print only the code box, not the whole screen.
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  .recovery-print, .recovery-print * { visibility: visible !important; }
  .recovery-print { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; color: #000; }
}`

interface Props {
  code: string
  shopName?: string
  acknowledged: boolean
  onAcknowledged: (v: boolean) => void
}

export const RecoveryCodeDisplay: React.FC<Props> = ({
  code,
  shopName,
  acknowledged,
  onAcknowledged
}) => {
  const { t } = useTranslation()
  return (
    <Stack gap="md" align="center">
      <style>{PRINT_CSS}</style>
      <Alert color="orange" title={t('recovery.writeDownTitle')} style={{ width: '100%' }}>
        {t('recovery.writeDownText')}
      </Alert>
      <div className="recovery-print" style={{ textAlign: 'center' }}>
        <Text fw={600}>{shopName ? `${shopName} - ` : ''}{t('recovery.codeLabel')}</Text>
        <Code
          style={{ fontSize: 36, letterSpacing: 4, padding: '12px 20px', userSelect: 'all' }}
          dir="ltr"
        >
          {code}
        </Code>
        <Text size="sm" mt="xs">
          {t('recovery.keepSafe')}
        </Text>
      </div>
      <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
        {t('recovery.print')}
      </Button>
      <Checkbox
        label={t('recovery.writtenDown')}
        checked={acknowledged}
        onChange={(e) => onAcknowledged(e.currentTarget.checked)}
      />
    </Stack>
  )
}
