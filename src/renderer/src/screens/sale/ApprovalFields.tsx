import React, { useEffect, useState } from 'react'
import { PasswordInput, Select } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'

export interface ApprovalValue {
  userId: number | null
  pin: string
}

/** Pick a manager/owner and type their PIN (void, or a cashier's return). */
export const ApprovalFields: React.FC<{ value: ApprovalValue; onChange: (v: ApprovalValue) => void; ownerOnly?: boolean }> = ({ value, onChange, ownerOnly }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [approvers, setApprovers] = useState<Array<{ value: string; label: string }>>([])

  useEffect(() => {
    void window.api.users.list().then((r) => {
      if (!r.ok) return
      const list = r.data.filter((u) => u.active === 1 && (u.role === 'owner' || (!ownerOnly && u.role === 'manager')))
      setApprovers(list.map((u) => ({ value: String(u.id), label: `${u.name} (${t(`roles.${u.role}`)})` })))
      if (value.userId === null) {
        const me = list.find((u) => u.id === user?.id) ?? list[0]
        if (me) onChange({ ...value, userId: me.id })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Select
        label={t('sale.approver')}
        data={approvers}
        value={value.userId === null ? null : String(value.userId)}
        onChange={(v) => onChange({ ...value, userId: v ? Number(v) : null })}
        allowDeselect={false}
      />
      <PasswordInput
        label={t('sale.approverPin')}
        value={value.pin}
        onChange={(e) => onChange({ ...value, pin: e.currentTarget.value })}
        maxLength={6}
        inputMode="numeric"
      />
    </>
  )
}
