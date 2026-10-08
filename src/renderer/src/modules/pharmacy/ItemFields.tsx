import React, { useEffect, useRef, useState } from 'react'
import { Card, Select, SimpleGrid, Text, TextInput } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import type { PharmacyItemInfo } from '@shared/types'

const EMPTY: PharmacyItemInfo = { genericName: '', manufacturer: '', strength: '', form: '', schedule: null, rack: '' }

/** Medicine details block on the item form. Sends its data to the form; saved together with the item. */
export const ItemFields: React.FC<{ itemId?: number; onChange: (data: Record<string, unknown>) => void }> = ({ itemId, onChange }) => {
  const { t } = useTranslation()
  const [info, setInfo] = useState<PharmacyItemInfo>(EMPTY)
  const [loaded, setLoaded] = useState(itemId === undefined)
  const emit = useRef(onChange)
  emit.current = onChange

  useEffect(() => {
    if (itemId === undefined) return
    void window.api.pharmacy.getItemInfo(itemId).then((r) => {
      if (r.ok && r.data) setInfo(r.data)
      setLoaded(true)
    })
  }, [itemId])

  // Only report once loaded, so an edit that touched nothing never wipes saved details.
  useEffect(() => {
    if (loaded) emit.current({ ...info })
  }, [info, loaded])

  const set = (k: keyof PharmacyItemInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setInfo((p) => ({ ...p, [k]: e.currentTarget.value }))

  return (
    <Card withBorder radius="md" p="sm" mt="sm">
      <Text fw={600} size="sm" c="dimmed" mb="xs">{t('pharmacy.itemTitle')}</Text>
      <SimpleGrid cols={2}>
        <TextInput label={t('pharmacy.genericName')} value={info.genericName} onChange={set('genericName')} maxLength={120} />
        <TextInput label={t('pharmacy.manufacturer')} value={info.manufacturer} onChange={set('manufacturer')} maxLength={120} />
        <TextInput label={t('pharmacy.strength')} placeholder="500mg" value={info.strength} onChange={set('strength')} maxLength={120} />
        <TextInput label={t('pharmacy.form')} placeholder={t('pharmacy.formHint')} value={info.form} onChange={set('form')} maxLength={120} />
        <Select
          label={t('pharmacy.schedule')}
          clearable
          data={[
            { value: 'otc', label: t('pharmacy.otc') },
            { value: 'rx', label: t('pharmacy.rx') },
            { value: 'controlled', label: t('pharmacy.controlled') }
          ]}
          value={info.schedule}
          onChange={(v) => setInfo((p) => ({ ...p, schedule: (v as PharmacyItemInfo['schedule']) ?? null }))}
        />
        <TextInput label={t('pharmacy.rack')} value={info.rack} onChange={set('rack')} maxLength={120} />
      </SimpleGrid>
    </Card>
  )
}
