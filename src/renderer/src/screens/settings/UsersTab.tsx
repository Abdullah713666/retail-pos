import React, { useState } from 'react'
import {
  Stack,
  Group,
  Button,
  Table,
  Badge,
  Modal,
  TextInput,
  PasswordInput,
  Select,
  Alert
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import type { User, Role } from '@shared/types'

interface UsersTabProps {
  userList: User[]
  currentUserId: number
  onUserChanged: () => Promise<void>
}

export const UsersTab: React.FC<UsersTabProps> = ({
  userList,
  currentUserId,
  onUserChanged
}) => {
  const { t } = useTranslation()

  const [userModalOpen, setUserModalOpen] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserUsername, setNewUserUsername] = useState('')
  const [newUserPin, setNewUserPin] = useState('')
  const [newUserRole, setNewUserRole] = useState<Role>('cashier')
  const [userModalError, setUserModalError] = useState<string | null>(null)
  const [creatingUser, setCreatingUser] = useState(false)

  const handleCreateUser = async (): Promise<void> => {
    setUserModalError(null)
    if (!newUserName.trim() || !newUserUsername.trim()) {
      setUserModalError(t('common.required'))
      return
    }
    if (!/^\d{4,6}$/.test(newUserPin)) {
      setUserModalError(t('wizard.pinLengthError'))
      return
    }

    setCreatingUser(true)
    try {
      const res = await window.api.users.create({
        name: newUserName.trim(),
        username: newUserUsername.trim().toLowerCase(),
        pin: newUserPin,
        role: newUserRole
      })

      if (res.ok) {
        setUserModalOpen(false)
        setNewUserName('')
        setNewUserUsername('')
        setNewUserPin('')
        setNewUserRole('cashier')
        await onUserChanged()
      } else {
        setUserModalError(res.error.message)
      }
    } catch (err) {
      setUserModalError((err as Error).message)
    } finally {
      setCreatingUser(false)
    }
  }

  const handleDeactivateUser = async (targetId: number): Promise<void> => {
    try {
      const res = await window.api.users.deactivate(targetId)
      if (res.ok) {
        await onUserChanged()
      } else {
        notifications.show({
          title: t('common.error'),
          message: res.error.message,
          color: 'red'
        })
      }
    } catch (err) {
      notifications.show({
        title: t('common.error'),
        message: (err as Error).message,
        color: 'red'
      })
    }
  }

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button onClick={() => setUserModalOpen(true)}>{t('settings.addUser')}</Button>
      </Group>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('settings.name')}</Table.Th>
            <Table.Th>{t('settings.username')}</Table.Th>
            <Table.Th>{t('settings.role')}</Table.Th>
            <Table.Th>{t('settings.status')}</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {userList.map((u) => (
            <Table.Tr key={u.id}>
              <Table.Td>{u.name}</Table.Td>
              <Table.Td>@{u.username}</Table.Td>
              <Table.Td>
                <Badge>{t(`roles.${u.role}`)}</Badge>
              </Table.Td>
              <Table.Td>
                <Badge color={u.active ? 'green' : 'gray'}>
                  {u.active ? t('settings.active') : t('settings.inactive')}
                </Badge>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                {u.active === 1 && u.id !== currentUserId && (
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    onClick={() => handleDeactivateUser(u.id)}
                  >
                    {t('settings.deactivate')}
                  </Button>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal
        opened={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={t('settings.addUser')}
      >
        <Stack gap="md">
          {userModalError && <Alert color="red">{userModalError}</Alert>}
          <TextInput
            required
            label={t('settings.name')}
            value={newUserName}
            onChange={(e) => setNewUserName(e.currentTarget.value)}
          />
          <TextInput
            required
            label={t('settings.username')}
            value={newUserUsername}
            onChange={(e) => setNewUserUsername(e.currentTarget.value)}
          />
          <PasswordInput
            required
            label={t('settings.pin')}
            placeholder="4–6 digits"
            maxLength={6}
            value={newUserPin}
            onChange={(e) => setNewUserPin(e.currentTarget.value.replace(/\D/g, ''))}
          />
          <Select
            label={t('settings.role')}
            value={newUserRole}
            onChange={(val) => setNewUserRole((val as Role) || 'cashier')}
            data={[
              { value: 'cashier', label: t('roles.cashier') },
              { value: 'manager', label: t('roles.manager') },
              { value: 'owner', label: t('roles.owner') }
            ]}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setUserModalOpen(false)}>
              {t('settings.cancel')}
            </Button>
            <Button onClick={handleCreateUser} loading={creatingUser}>
              {t('settings.addUser')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
