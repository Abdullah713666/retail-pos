import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Group, Loader, Stack, Table, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { BackupStatus } from '@shared/types'

/** What the owner has asked to restore, waiting for the confirm dialog. */
interface PendingRestore {
  /** A listed backup; undefined means the file picked with the file dialog. */
  name?: string
  label: string
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const BackupTab: React.FC = () => {
  const { t } = useTranslation()
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingRestore | null>(null)
  const [restarting, setRestarting] = useState(false)

  const error = useCallback(
    (message: string): void => {
      notifications.show({ color: 'red', title: t('common.error'), message, autoClose: 10000 })
    },
    [t]
  )

  const load = useCallback(async (): Promise<void> => {
    const res = await window.api.backup.status()
    if (res.ok) setStatus(res.data)
    else error(res.error.message)
  }, [error])

  useEffect(() => {
    load()
  }, [load])

  const backupNow = async (): Promise<void> => {
    setBusy(true)
    const res = await window.api.backup.now()
    setBusy(false)
    if (!res.ok) return error(res.error.message)
    notifications.show({ color: 'teal', title: t('common.success'), message: t('backup.done', { name: res.data.name }) })
    if (res.data.extraError) {
      notifications.show({ color: 'orange', title: t('backup.extraFailedTitle'), message: t('backup.extraFailed', { reason: res.data.extraError }), autoClose: 12000 })
    }
    load()
  }

  const chooseExtra = async (): Promise<void> => {
    const res = await window.api.backup.chooseExtraDir()
    if (!res.ok) return error(res.error.message)
    load()
  }

  const clearExtra = async (): Promise<void> => {
    const res = await window.api.backup.clearExtraDir()
    if (!res.ok) return error(res.error.message)
    load()
  }

  const pickFile = async (): Promise<void> => {
    const res = await window.api.backup.pickFile()
    if (!res.ok) return error(res.error.message)
    if (res.data) setPending({ label: res.data.fileName })
  }

  const restore = async (): Promise<void> => {
    if (!pending) return
    const req = pending
    setPending(null)
    setBusy(true)
    const res = await window.api.backup.restore({ name: req.name })
    setBusy(false)
    if (!res.ok) return error(res.error.message)
    setRestarting(true)
  }

  if (restarting) {
    return (
      <Alert color="teal" title={t('backup.restoredTitle')}>
        <Group><Loader size="sm" /><Text>{t('backup.restarting')}</Text></Group>
      </Alert>
    )
  }

  return (
    <Stack>
      <Text size="sm">
        {t('backup.lastBackup')}: <b>{status?.lastBackupAt ?? t('backup.never')}</b>
      </Text>
      <Text size="sm" c="dimmed">{t('backup.autoNote', { count: status?.keep ?? 30 })}</Text>

      <Group>
        <Button onClick={backupNow} loading={busy}>{t('backup.now')}</Button>
      </Group>

      <Stack gap={4}>
        <Text fw={600}>{t('backup.extraFolder')}</Text>
        <Text size="sm" c="dimmed">{t('backup.extraHint')}</Text>
        <Group>
          <Text size="sm">{status?.extraDir || t('backup.notSet')}</Text>
          <Button size="xs" variant="default" onClick={chooseExtra}>{t('backup.chooseFolder')}</Button>
          {status?.extraDir && <Button size="xs" variant="subtle" color="red" onClick={clearExtra}>{t('backup.stopExtra')}</Button>}
        </Group>
      </Stack>

      <Stack gap={4}>
        <Text fw={600}>{t('backup.restoreTitle')}</Text>
        <Alert color="orange">{t('backup.restoreWarning')}</Alert>
        <Group>
          <Button variant="default" onClick={pickFile} disabled={busy}>{t('backup.restoreFromFile')}</Button>
        </Group>
      </Stack>

      <Text fw={600}>{t('backup.saved')}</Text>
      {status && status.backups.length === 0 ? (
        <Text size="sm" c="dimmed">{t('backup.none')}</Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr><Table.Th>{t('backup.file')}</Table.Th><Table.Th>{t('backup.size')}</Table.Th><Table.Th /></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(status?.backups ?? []).slice(0, 15).map((b) => (
              <Table.Tr key={b.name}>
                <Table.Td>{b.name}</Table.Td>
                <Table.Td>{formatSize(b.size)}</Table.Td>
                <Table.Td>
                  <Button size="xs" variant="light" color="orange" disabled={busy} onClick={() => setPending({ name: b.name, label: b.name })}>
                    {t('backup.restore')}
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <ConfirmDialog
        opened={pending !== null}
        title={t('backup.confirmTitle')}
        message={t('backup.confirmMessage', { file: pending?.label ?? '' })}
        confirmLabel={t('backup.confirmYes')}
        cancelLabel={t('backup.cancel')}
        onConfirm={restore}
        onCancel={() => setPending(null)}
      />
    </Stack>
  )
}
