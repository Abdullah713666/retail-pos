import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Tabs,
  TextInput,
  Button,
  Group,
  Stack,
  Radio,
  SegmentedControl,
  Switch,
  Alert,
  Text
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useModules } from '../modules'
import { changeAppLanguage } from '../i18n'
import { UsersTab } from './settings/UsersTab'
import type { User } from '@shared/types'

export const SettingsScreen: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { enabledModules, refresh: refreshModules } = useModules()

  // Form states
  const [shopName, setShopName] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [shopPhone, setShopPhone] = useState('')
  const [receiptFooter, setReceiptFooter] = useState('')
  const [printerName, setPrinterName] = useState('')
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm')
  const [language, setLanguage] = useState<'en' | 'ur'>((i18n.language as 'en' | 'ur') || 'en')
  const [pharmacyEnabled, setPharmacyEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  // Users tab state
  const [userList, setUserList] = useState<User[]>([])

  const loadSettingsAndUsers = useCallback(async (): Promise<void> => {
    try {
      if (window.api?.settings) {
        const res = await window.api.settings.getAll()
        if (res.ok) {
          const s = res.data
          setShopName(s['shop_name'] || '')
          setShopAddress(s['shop_address'] || '')
          setShopPhone(s['shop_phone'] || '')
          setReceiptFooter(s['receipt_footer'] || '')
          setPrinterName(s['printer_name'] || '')
          setPaperWidth(s['paper_width'] === '58mm' ? '58mm' : '80mm')
          if (s['language'] === 'ur' || s['language'] === 'en') {
            setLanguage(s['language'])
          }
        }
      }

      setPharmacyEnabled(enabledModules.includes('pharmacy'))

      if (window.api?.users) {
        const uRes = await window.api.users.list()
        if (uRes.ok) {
          setUserList(uRes.data)
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }, [enabledModules])

  useEffect(() => {
    loadSettingsAndUsers()
  }, [loadSettingsAndUsers])

  const handleLanguageChange = (val: string): void => {
    const lang = val as 'en' | 'ur'
    setLanguage(lang)
    changeAppLanguage(lang)
  }

  const handleSaveSettings = async (): Promise<void> => {
    setSaving(true)
    try {
      const payload: Record<string, string> = {
        shop_name: shopName.trim(),
        shop_address: shopAddress.trim(),
        shop_phone: shopPhone.trim(),
        receipt_footer: receiptFooter.trim(),
        printer_name: printerName.trim(),
        paper_width: paperWidth,
        language
      }

      const res = await window.api.settings.setMany(payload)
      if (res.ok) {
        const desiredModules = pharmacyEnabled ? ['pharmacy'] : []
        const modRes = await window.api.modules.setEnabled(desiredModules)
        if (modRes.ok) {
          await refreshModules()
        }

        notifications.show({
          title: t('common.success'),
          message: t('settings.saved'),
          color: 'teal'
        })
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
    } finally {
      setSaving(false)
    }
  }

  if (user?.role !== 'owner') {
    return (
      <div>
        <PageHeader title={t('screens.settings.title')} subtitle={t('screens.settings.subtitle')} />
        <Alert color="red" title={t('common.error')}>
          {t('settings.ownerOnlyNotice')}
        </Alert>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={t('screens.settings.title')} subtitle={t('screens.settings.subtitle')} />

      <Card withBorder shadow="sm" p="lg" radius="md">
        <Tabs defaultValue="shop">
          <Tabs.List mb="md">
            <Tabs.Tab value="shop">{t('settings.shopInfo')}</Tabs.Tab>
            <Tabs.Tab value="printer">{t('settings.printer')}</Tabs.Tab>
            <Tabs.Tab value="language">{t('settings.language')}</Tabs.Tab>
            <Tabs.Tab value="modules">{t('settings.modules')}</Tabs.Tab>
            <Tabs.Tab value="users">{t('settings.users')}</Tabs.Tab>
          </Tabs.List>

          {/* Shop Information */}
          <Tabs.Panel value="shop">
            <Stack gap="md" style={{ maxWidth: 500 }}>
              <TextInput
                label={t('wizard.shopName')}
                value={shopName}
                onChange={(e) => setShopName(e.currentTarget.value)}
              />
              <TextInput
                label={t('wizard.shopAddress')}
                value={shopAddress}
                onChange={(e) => setShopAddress(e.currentTarget.value)}
              />
              <TextInput
                label={t('wizard.shopPhone')}
                value={shopPhone}
                onChange={(e) => setShopPhone(e.currentTarget.value)}
              />
              <TextInput
                label={t('wizard.receiptFooter')}
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.currentTarget.value)}
              />
              <Button onClick={handleSaveSettings} loading={saving} style={{ alignSelf: 'flex-start' }}>
                {t('settings.save')}
              </Button>
            </Stack>
          </Tabs.Panel>

          {/* Printer & Hardware */}
          <Tabs.Panel value="printer">
            <Stack gap="md" style={{ maxWidth: 500 }}>
              <TextInput
                label={t('wizard.printerName')}
                value={printerName}
                onChange={(e) => setPrinterName(e.currentTarget.value)}
              />
              <Radio.Group
                label={t('wizard.paperWidth')}
                value={paperWidth}
                onChange={(val) => setPaperWidth(val as '58mm' | '80mm')}
              >
                <Group mt="xs">
                  <Radio value="80mm" label="80 mm" />
                  <Radio value="58mm" label="58 mm" />
                </Group>
              </Radio.Group>
              <Button onClick={handleSaveSettings} loading={saving} style={{ alignSelf: 'flex-start' }}>
                {t('settings.save')}
              </Button>
            </Stack>
          </Tabs.Panel>

          {/* Language */}
          <Tabs.Panel value="language">
            <Stack gap="md" style={{ maxWidth: 500 }}>
              <Text fw={500}>{t('wizard.selectLanguage')}</Text>
              <SegmentedControl
                value={language}
                onChange={handleLanguageChange}
                data={[
                  { label: t('wizard.english'), value: 'en' },
                  { label: t('wizard.urdu'), value: 'ur' }
                ]}
              />
              <Button onClick={handleSaveSettings} loading={saving} style={{ alignSelf: 'flex-start' }}>
                {t('settings.save')}
              </Button>
            </Stack>
          </Tabs.Panel>

          {/* Modules */}
          <Tabs.Panel value="modules">
            <Stack gap="md" style={{ maxWidth: 500 }}>
              <Switch
                label={t('settings.pharmacyModule')}
                description={t('settings.pharmacyModuleDesc')}
                checked={pharmacyEnabled}
                onChange={(e) => setPharmacyEnabled(e.currentTarget.checked)}
              />
              <Button onClick={handleSaveSettings} loading={saving} style={{ alignSelf: 'flex-start' }}>
                {t('settings.save')}
              </Button>
            </Stack>
          </Tabs.Panel>

          {/* User Management */}
          <Tabs.Panel value="users">
            <UsersTab
              userList={userList}
              currentUserId={user.id}
              onUserChanged={loadSettingsAndUsers}
            />
          </Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  )
}
