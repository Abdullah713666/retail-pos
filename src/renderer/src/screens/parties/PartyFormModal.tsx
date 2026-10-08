import React, { useEffect, useState } from 'react'
import { Modal, TextInput, Button, Group, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { toPaisa, fromPaisa } from '@shared/money'
import type { Party, PartyType } from '@shared/types'

interface Props {
  opened: boolean
  onClose: () => void
  type: PartyType
  party: Party | null
  canSetMoney: boolean
  onSaved: () => void
}

export const PartyFormModal: React.FC<Props> = ({ opened, onClose, type, party, canSetMoney, onSaved }) => {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [opening, setOpening] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!opened) return
    setName(party?.name ?? '')
    setPhone(party?.phone ?? '')
    setAddress(party?.address ?? '')
    setCreditLimit(party && party.creditLimit > 0 ? String(fromPaisa(party.creditLimit)) : '')
    setOpening('')
  }, [opened, party])

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return
    let limitPaisa = 0
    let openingPaisa = 0
    try {
      limitPaisa = toPaisa(creditLimit || '0')
      openingPaisa = toPaisa(opening || '0')
    } catch {
      notifications.show({ color: 'red', message: t('parties.invalidAmount') })
      return
    }
    if (limitPaisa < 0 || openingPaisa < 0) {
      notifications.show({ color: 'red', message: t('parties.invalidAmount') })
      return
    }

    setSaving(true)
    try {
      const res = party
        ? await window.api.parties.update({
            id: party.id,
            name,
            phone: phone || null,
            address: address || null,
            creditLimit: type === 'customer' && canSetMoney ? limitPaisa : undefined
          })
        : await window.api.parties.create({
            type,
            name,
            phone: phone || null,
            address: address || null,
            creditLimit: type === 'customer' ? limitPaisa : undefined,
            openingBalance: openingPaisa
          })
      if (res.ok) {
        notifications.show({ color: 'green', message: t('parties.saved') })
        onSaved()
      } else {
        notifications.show({ color: 'red', message: res.error.message })
      }
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const title = party
    ? t(type === 'customer' ? 'parties.editCustomer' : 'parties.editSupplier')
    : t(type === 'customer' ? 'parties.addCustomer' : 'parties.addSupplier')

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={600}>{title}</Text>} centered>
      <Stack
        gap="sm"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !saving) handleSave()
        }}
      >
        <TextInput
          label={t('parties.name')}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          data-autofocus
          required
        />
        <TextInput label={t('parties.phone')} value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
        <TextInput label={t('parties.address')} value={address} onChange={(e) => setAddress(e.currentTarget.value)} />
        {type === 'customer' && canSetMoney && (
          <TextInput
            label={t('parties.creditLimit')}
            placeholder="0.00"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.currentTarget.value)}
          />
        )}
        {!party && canSetMoney && (
          <TextInput
            label={t(type === 'customer' ? 'parties.openingCustomer' : 'parties.openingSupplier')}
            description={t(type === 'customer' ? 'parties.openingCustomerHint' : 'parties.openingSupplierHint')}
            placeholder="0.00"
            value={opening}
            onChange={(e) => setOpening(e.currentTarget.value)}
          />
        )}
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            {t('items.cancel')}
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>
            {t('parties.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
