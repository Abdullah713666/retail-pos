import React, { useEffect, useState } from 'react'
import { Button, Modal, NumberInput, Select, Stack } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import type { ItemUnit } from '@shared/types'
import type { CartLine } from './useSaleCart'

interface Props {
  line: CartLine | null
  onClose: () => void
  onApply: (unit: ItemUnit | null, qty: number) => void
}

/** F2: change the selling unit (base / Strip / Box...) and the quantity of the selected line. */
export const UnitDialog: React.FC<Props> = ({ line, onClose, onApply }) => {
  const { t } = useTranslation()
  const [unitId, setUnitId] = useState<string>('base')
  const [qty, setQty] = useState<number | string>(1)

  useEffect(() => {
    if (line) {
      setUnitId(line.unit ? String(line.unit.id) : 'base')
      setQty(line.qty)
    }
  }, [line])

  if (!line) return null
  const options = [
    { value: 'base', label: `${line.item.baseUnit} (1)` },
    ...line.item.units.map((u) => ({ value: String(u.id), label: `${u.name} (${u.factor})` }))
  ]
  const q = Number(qty)
  const valid = Number.isInteger(q) && q > 0

  return (
    <Modal opened onClose={onClose} title={line.item.name} centered>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          onApply(line.item.units.find((u) => String(u.id) === unitId) ?? null, q)
          onClose()
        }}
      >
        <Stack>
          <NumberInput
            data-autofocus
            size="md"
            label={t('sale.qty')}
            min={1}
            allowDecimal={false}
            allowNegative={false}
            value={qty}
            onChange={setQty}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Select size="md" label={t('sale.unit')} data={options} value={unitId} onChange={(v) => setUnitId(v ?? 'base')} allowDeselect={false} />
          <Button type="submit" disabled={!valid}>{t('sale.apply')} (Enter)</Button>
        </Stack>
      </form>
    </Modal>
  )
}
