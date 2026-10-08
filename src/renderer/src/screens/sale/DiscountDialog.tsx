import React, { useEffect, useState } from 'react'
import { Button, Modal, SegmentedControl, Stack, Text, TextInput } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { parseMoney, moneyText } from './moneyText'

export interface DiscountValue {
  scope: 'line' | 'bill'
  discount: number
  bp: number | null
}

interface Props {
  opened: boolean
  hasLine: boolean
  onClose: () => void
  onApply: (v: DiscountValue) => void
}

/** F4. Arrow keys switch the segments, Tab moves to the amount, Enter applies. 0 removes a discount. */
export const DiscountDialog: React.FC<Props> = ({ opened, hasLine, onClose, onApply }) => {
  const { t } = useTranslation()
  const [scope, setScope] = useState<'line' | 'bill'>('line')
  const [mode, setMode] = useState<'amount' | 'percent'>('amount')
  const [text, setText] = useState('')

  useEffect(() => {
    if (opened) {
      setScope(hasLine ? 'line' : 'bill')
      setMode('amount')
      setText('')
    }
  }, [opened, hasLine])

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (mode === 'amount') {
      const v = parseMoney(text)
      if (v === null) return
      onApply({ scope, discount: v, bp: null })
    } else {
      const p = Number(text.trim() || '0')
      if (!Number.isFinite(p) || p < 0 || p > 100) return
      onApply({ scope, discount: 0, bp: Math.round(p * 100) })
    }
    onClose()
  }

  const bad = mode === 'amount' ? parseMoney(text) === null : !(Number(text.trim() || '0') >= 0 && Number(text.trim() || '0') <= 100)

  return (
    <Modal opened={opened} onClose={onClose} title={t('sale.discount')} centered>
      <form onSubmit={submit}>
        <Stack>
          <SegmentedControl
            value={scope}
            onChange={(v) => setScope(v as 'line' | 'bill')}
            data={[
              { value: 'line', label: t('sale.discountLine'), disabled: !hasLine },
              { value: 'bill', label: t('sale.discountBill') }
            ]}
          />
          <SegmentedControl
            value={mode}
            onChange={(v) => setMode(v as 'amount' | 'percent')}
            data={[
              { value: 'amount', label: 'Rs' },
              { value: 'percent', label: '%' }
            ]}
          />
          <TextInput
            data-autofocus
            size="md"
            label={mode === 'amount' ? t('sale.discountAmount') : t('sale.discountPercent')}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            placeholder={mode === 'amount' ? moneyText(0) : '0'}
            error={bad ? t('sale.badAmount') : undefined}
          />
          <Text size="xs" c="dimmed">{t('sale.discountHint')}</Text>
          <Button type="submit" disabled={bad}>{t('sale.apply')} (Enter)</Button>
        </Stack>
      </form>
    </Modal>
  )
}
