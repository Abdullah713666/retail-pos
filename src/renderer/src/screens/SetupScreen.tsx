import React, { useState } from 'react'
import {
  Stepper,
  Button,
  Group,
  Card,
  Title,
  Text,
  Alert
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { RecoveryCodeDisplay } from '../components/RecoveryCodeDisplay'
import { useAuth } from '../context/AuthContext'
import { useModules } from '../modules'
import { changeAppLanguage } from '../i18n'
import {
  ShopStep,
  BusinessTypeStep,
  OwnerStep,
  PrinterStep,
  LanguageStep
} from './setup/SetupSteps'

export const SetupScreen: React.FC = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { refreshAuth } = useAuth()
  const { refresh: refreshModules } = useModules()

  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)

  // Step 1: Shop Details
  const [shopName, setShopName] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [shopPhone, setShopPhone] = useState('')
  const [receiptFooter, setReceiptFooter] = useState('Thank you for your visit!')

  // Step 2: Business Type
  const [businessType, setBusinessType] = useState<'general' | 'pharmacy'>('general')

  // Step 3: Owner Account
  const [ownerName, setOwnerName] = useState('')
  const [ownerUsername, setOwnerUsername] = useState('owner')
  const [ownerPin, setOwnerPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  // Step 4: Printer
  const [printerName, setPrinterName] = useState('')
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm')

  // Step 5: Language
  const [language, setLanguage] = useState<'en' | 'ur'>((i18n.language as 'en' | 'ur') || 'en')

  const handleLanguageChange = (val: string): void => {
    const lang = val as 'en' | 'ur'
    setLanguage(lang)
    changeAppLanguage(lang)
  }

  const validateStep = (): boolean => {
    setError(null)
    if (activeStep === 0) {
      if (!shopName.trim()) {
        setError(t('common.required'))
        return false
      }
    } else if (activeStep === 2) {
      if (!ownerName.trim() || !ownerUsername.trim()) {
        setError(t('common.required'))
        return false
      }
      if (!/^\d{4,6}$/.test(ownerPin)) {
        setError(t('wizard.pinLengthError'))
        return false
      }
      if (ownerPin !== confirmPin) {
        setError(t('wizard.pinMismatch'))
        return false
      }
    }
    return true
  }

  const nextStep = (): void => {
    if (validateStep()) {
      setActiveStep((current) => Math.min(current + 1, 4))
    }
  }

  const prevStep = (): void => {
    setError(null)
    setActiveStep((current) => Math.max(current - 1, 0))
  }

  const handleFinish = async (): Promise<void> => {
    if (!validateStep()) return
    setLoading(true)
    setError(null)

    try {
      const moduleIds = businessType === 'pharmacy' ? ['pharmacy'] : []
      const res = await window.api.setup.complete({
        shop: {
          name: shopName.trim(),
          address: shopAddress.trim(),
          phone: shopPhone.trim()
        },
        language,
        paperWidth,
        printerName: printerName.trim(),
        receiptFooter: receiptFooter.trim(),
        moduleIds,
        owner: {
          name: ownerName.trim(),
          username: ownerUsername.trim().toLowerCase(),
          pin: ownerPin
        }
      })

      if (!res.ok) {
        setError(res.error.message)
        setLoading(false)
        return
      }

      // Show the recovery code once. The app only opens after it is confirmed.
      setRecoveryCode(res.data.recoveryCode)
    } catch (err) {
      setError((err as Error).message || 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleEnter = async (): Promise<void> => {
    await refreshModules()
    await refreshAuth()
    setRecoveryCode(null)
    notifications.show({
      title: t('common.success'),
      message: t('wizard.title'),
      color: 'green'
    })
    navigate('/')
  }

  if (recoveryCode) {
    return (
      <div style={{ maxWidth: 760, margin: '40px auto', padding: '0 20px' }}>
        <Card withBorder shadow="md" p="xl" radius="md">
          <Title order={2} c="blue" mb="md">
            {t('recovery.setupTitle')}
          </Title>
          <RecoveryCodeDisplay
            code={recoveryCode}
            shopName={shopName.trim()}
            acknowledged={acknowledged}
            onAcknowledged={setAcknowledged}
          />
          <Group justify="flex-end" mt="xl">
            <Button color="green" disabled={!acknowledged} onClick={handleEnter}>
              {t('wizard.finish')}
            </Button>
          </Group>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 760, margin: '40px auto', padding: '0 20px' }}>
      <Card withBorder shadow="md" p="xl" radius="md">
        <Title order={2} c="blue" mb={4}>
          {t('wizard.title')}
        </Title>
        <Text c="dimmed" size="sm" mb="xl">
          {t('wizard.subtitle')}
        </Text>

        {error && (
          <Alert color="red" mb="md" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stepper active={activeStep} onStepClick={setActiveStep} mb="xl">
          <Stepper.Step label={t('wizard.stepShop')} />
          <Stepper.Step label={t('wizard.stepBusiness')} />
          <Stepper.Step label={t('wizard.stepOwner')} />
          <Stepper.Step label={t('wizard.stepPrinter')} />
          <Stepper.Step label={t('wizard.stepLanguage')} />
        </Stepper>

        {activeStep === 0 && (
          <ShopStep
            shopName={shopName}
            setShopName={setShopName}
            shopAddress={shopAddress}
            setShopAddress={setShopAddress}
            shopPhone={shopPhone}
            setShopPhone={setShopPhone}
            receiptFooter={receiptFooter}
            setReceiptFooter={setReceiptFooter}
          />
        )}

        {activeStep === 1 && (
          <BusinessTypeStep
            businessType={businessType}
            setBusinessType={setBusinessType}
          />
        )}

        {activeStep === 2 && (
          <OwnerStep
            ownerName={ownerName}
            setOwnerName={setOwnerName}
            ownerUsername={ownerUsername}
            setOwnerUsername={setOwnerUsername}
            ownerPin={ownerPin}
            setOwnerPin={setOwnerPin}
            confirmPin={confirmPin}
            setConfirmPin={setConfirmPin}
          />
        )}

        {activeStep === 3 && (
          <PrinterStep
            printerName={printerName}
            setPrinterName={setPrinterName}
            paperWidth={paperWidth}
            setPaperWidth={setPaperWidth}
          />
        )}

        {activeStep === 4 && (
          <LanguageStep
            language={language}
            onLanguageChange={handleLanguageChange}
          />
        )}

        <Group justify="space-between" mt="xl">
          <Button variant="default" onClick={prevStep} disabled={activeStep === 0}>
            {t('wizard.back')}
          </Button>

          {activeStep < 4 ? (
            <Button onClick={nextStep}>{t('wizard.next')}</Button>
          ) : (
            <Button color="green" onClick={handleFinish} loading={loading}>
              {t('wizard.finish')}
            </Button>
          )}
        </Group>
      </Card>
    </div>
  )
}
