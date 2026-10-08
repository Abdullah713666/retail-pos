import React, { useEffect, useState } from 'react'
import { Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import type { AllocationPreview } from '@shared/types'

/** Under a sale line: which batch(es) FEFO will use, with expiry. Preview only; the sale re-allocates on save. */
export const SaleLineInfo: React.FC<{ itemId: number; qtyBase: number }> = ({ itemId, qtyBase }) => {
  const { t } = useTranslation()
  const [p, setP] = useState<AllocationPreview | null>(null)

  useEffect(() => {
    let stale = false
    void window.api.pharmacy.previewAllocation({ itemId, qtyBase }).then((r) => {
      if (!stale) setP(r.ok ? r.data : null)
    })
    return () => {
      stale = true
    }
  }, [itemId, qtyBase])

  if (!p || !p.tracked) return null
  return (
    <>
      {p.chunks.map((c) => (
        <Text key={c.lotId} size="xs" c={c.expired ? 'red' : 'dimmed'}>
          {t('pharmacy.batchLine', { batch: c.lotNo, exp: c.expiryDate ?? '-', qty: c.qtyBase })}
          {c.expired ? ` (${t('pharmacy.expired')})` : ''}
        </Text>
      ))}
      {p.needsOverride && (
        <Text size="xs" c="red" fw={600}>{t('pharmacy.needsOwner')}</Text>
      )}
    </>
  )
}
