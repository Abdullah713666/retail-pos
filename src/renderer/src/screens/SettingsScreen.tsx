import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Tabs,
  TextInput,
  Button,
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
import { BackupTab } from './settings/BackupTab'
import { RecoverySection } from './settings/RecoverySection'
import { PrinterFields } from '../components/PrinterFields'
import type { PrintMode, User } from '@shared/types'

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
  const [printMode, setPrintMode] = useState<PrintMode>('auto')
  const [allowNegative, setAllowNegative] = useState(false)
  const [language, setLanguage] = useState<'en' | 'ur'>((i18n.language as 'en' | 'ur') || 'en')
  const [pharmacyEnabled, setPharmacyEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  // Users tab state
  const [userList, setUserList] = useState<User[]>([])
  const [hasRecovery, setHasRecovery] = useState(true)

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
          setPrintMode(s['print_mode'] === 'ask' || s['print_mode'] === 'off' ? s['print_mode'] : 'auto')
          setAllowNegative(s['allow_negative_stock'] === '1')
          if (s['language'] === 'ur' || s['language'] === 'en') {
            setLanguage(s['language'])
          }
        }
      }

      if (window.api?.recovery) {
        const rRes = await window.api.recovery.status()
        if (rRes.ok) setHasRecovery(rRes.data.hasCode)
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
        print_mode: printMode,
        allow_negative_stock: allowNegative ? '1' : '0',
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

      {!hasRecovery && (
        <Alert color="orange" mb="md" title={t('recovery.bannerTitle')}>
          {t('recovery.bannerText')}
        </Alert>
      )}

      <Card withBorder shadow="sm" p="lg" radius="md">
        <Tabs defaultValue="shop">
          <Tabs.List mb="md">
            <Tabs.Tab value="shop">{t('settings.shopInfo')}</Tabs.Tab>
            <Tabs.Tab value="printer">{t('settings.printer')}</Tabs.Tab>
            <Tabs.Tab value="sales">{t('settings.sales')}</Tabs.Tab>
            <Tabs.Tab value="language">{t('settings.language')}</Tabs.Tab>
            <Tabs.Tab value="modules">{t('settings.modules')}</Tabs.Tab>
            <Tabs.Tab value="users">{t('settings.users')}</Tabs.Tab>
            <Tabs.Tab value="backup">{t('settings.backup')}</Tabs.Tab>
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
              <PrinterFields
                printerName={printerName}
                onPrinterName={setPrinterName}
                paperWidth={paperWidth}
                onPaperWidth={setPaperWidth}
              />
              <Radio.Group
                label={t('settings.printAfterSale')}
                value={printMode}
                onChange={(v) => setPrintMode(v as PrintMode)}
              >
                <Stack mt="xs" gap={4}>
                  <Radio value="auto" label={t('settings.printAuto')} />
                  <Radio value="ask" label={t('settings.printAsk')} />
                  <Radio value="off" label={t('settings.printOff')} />
                </Stack>
              </Radio.Group>
              <Button onClick={handleSaveSettings} loading={saving} style={{ alignSelf: 'flex-start' }}>
                {t('settings.save')}
              </Button>
            </Stack>
          </Tabs.Panel>

          {/* Sales rules */}
          <Tabs.Panel value="sales">
            <Stack gap="md" style={{ maxWidth: 500 }}>
              <Switch
                label={t('settings.allowNegative')}
                description={t('settings.allowNegativeDesc')}
                checked={allowNegative}
                onChange={(e) => setAllowNegative(e.currentTarget.checked)}
              />
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
            <RecoverySection
              hasCode={hasRecovery}
              shopName={shopName}
              onChanged={loadSettingsAndUsers}
            />
          </Tabs.Panel>

          {/* Backup & restore (owner only: this whole screen is) */}
          <Tabs.Panel value="backup">
            <BackupTab />
          </Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  )
}
