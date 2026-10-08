import React from 'react'
import {
  Stack,
  TextInput,
  PasswordInput,
  Radio,
  Group,
  Button,
  Text,
  SegmentedControl
} from '@mantine/core'
import { useTranslation } from 'react-i18next'

interface ShopStepProps {
  shopName: string
  setShopName: (v: string) => void
  shopAddress: string
  setShopAddress: (v: string) => void
  shopPhone: string
  setShopPhone: (v: string) => void
  receiptFooter: string
  setReceiptFooter: (v: string) => void
}

export const ShopStep: React.FC<ShopStepProps> = ({
  shopName,
  setShopName,
  shopAddress,
  setShopAddress,
  shopPhone,
  setShopPhone,
  receiptFooter,
  setReceiptFooter
}) => {
  const { t } = useTranslation()
  return (
    <Stack gap="md">
      <TextInput
        required
        label={t('wizard.shopName')}
        placeholder="e.g. Al-Madina Super Store"
        value={shopName}
        onChange={(e) => setShopName(e.currentTarget.value)}
      />
      <TextInput
        label={t('wizard.shopAddress')}
        placeholder="e.g. Main Market, Lahore"
        value={shopAddress}
        onChange={(e) => setShopAddress(e.currentTarget.value)}
      />
      <TextInput
        label={t('wizard.shopPhone')}
        placeholder="e.g. 0300-1234567"
        value={shopPhone}
        onChange={(e) => setShopPhone(e.currentTarget.value)}
      />
      <TextInput
        label={t('wizard.receiptFooter')}
        value={receiptFooter}
        onChange={(e) => setReceiptFooter(e.currentTarget.value)}
      />
    </Stack>
  )
}

interface BusinessTypeStepProps {
  businessType: 'general' | 'pharmacy'
  setBusinessType: (v: 'general' | 'pharmacy') => void
}

export const BusinessTypeStep: React.FC<BusinessTypeStepProps> = ({
  businessType,
  setBusinessType
}) => {
  const { t } = useTranslation()
  return (
    <Stack gap="md">
      <Radio.Group
        value={businessType}
        onChange={(val) => setBusinessType(val as 'general' | 'pharmacy')}
      >
        <Stack gap="sm">
          <Radio
            value="general"
            label={t('wizard.generalRetail')}
            description={t('wizard.generalRetailDesc')}
          />
          <Radio
            value="pharmacy"
            label={t('wizard.pharmacyRetail')}
            description={t('wizard.pharmacyRetailDesc')}
          />
        </Stack>
      </Radio.Group>
    </Stack>
  )
}

interface OwnerStepProps {
  ownerName: string
  setOwnerName: (v: string) => void
  ownerUsername: string
  setOwnerUsername: (v: string) => void
  ownerPin: string
  setOwnerPin: (v: string) => void
  confirmPin: string
  setConfirmPin: (v: string) => void
}

export const OwnerStep: React.FC<OwnerStepProps> = ({
  ownerName,
  setOwnerName,
  ownerUsername,
  setOwnerUsername,
  ownerPin,
  setOwnerPin,
  confirmPin,
  setConfirmPin
}) => {
  const { t } = useTranslation()
  return (
    <Stack gap="md">
      <TextInput
        required
        label={t('wizard.ownerName')}
        placeholder="e.g. Abdullah"
        value={ownerName}
        onChange={(e) => setOwnerName(e.currentTarget.value)}
      />
      <TextInput
        required
        label={t('wizard.ownerUsername')}
        value={ownerUsername}
        onChange={(e) => setOwnerUsername(e.currentTarget.value)}
      />
      <PasswordInput
        required
        label={t('wizard.ownerPin')}
        placeholder="4–6 digits"
        maxLength={6}
        value={ownerPin}
        onChange={(e) => setOwnerPin(e.currentTarget.value.replace(/\D/g, ''))}
      />
      <PasswordInput
        required
        label={t('wizard.confirmPin')}
        placeholder="Re-enter PIN"
        maxLength={6}
        value={confirmPin}
        onChange={(e) => setConfirmPin(e.currentTarget.value.replace(/\D/g, ''))}
      />
    </Stack>
  )
}

interface PrinterStepProps {
  printerName: string
  setPrinterName: (v: string) => void
  paperWidth: '58mm' | '80mm'
  setPaperWidth: (v: '58mm' | '80mm') => void
  onTestPrint: () => void
}

export const PrinterStep: React.FC<PrinterStepProps> = ({
  printerName,
  setPrinterName,
  paperWidth,
  setPaperWidth,
  onTestPrint
}) => {
  const { t } = useTranslation()
  return (
    <Stack gap="md">
      <TextInput
        label={t('wizard.printerName')}
        placeholder="e.g. POS-80 or leave empty for default"
        value={printerName}
        onChange={(e) => setPrinterName(e.currentTarget.value)}
      />
      <Radio.Group
        label={t('wizard.paperWidth')}
        value={paperWidth}
        onChange={(val) => setPaperWidth(val as '58mm' | '80mm')}
      >
        <Group mt="xs">
          <Radio value="80mm" label="80 mm (Standard Thermal)" />
          <Radio value="58mm" label="58 mm (Narrow Thermal)" />
        </Group>
      </Radio.Group>
      <Button variant="outline" onClick={onTestPrint}>
        {t('wizard.testPrint')}
      </Button>
    </Stack>
  )
}

interface LanguageStepProps {
  language: 'en' | 'ur'
  onLanguageChange: (v: string) => void
}

export const LanguageStep: React.FC<LanguageStepProps> = ({
  language,
  onLanguageChange
}) => {
  const { t } = useTranslation()
  return (
    <Stack gap="md">
      <Text fw={500}>{t('wizard.selectLanguage')}</Text>
      <SegmentedControl
        value={language}
        onChange={onLanguageChange}
        data={[
          { label: t('wizard.english'), value: 'en' },
          { label: t('wizard.urdu'), value: 'ur' }
        ]}
      />
    </Stack>
  )
}
