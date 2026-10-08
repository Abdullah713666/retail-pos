import React from 'react'
import { ActionIcon, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { IconMoon, IconSun } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

/** Switches between light and dark mode. Mantine saves the choice in localStorage. */
export function ColorSchemeToggle(): React.JSX.Element {
  const { t } = useTranslation()
  const { setColorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light')
  const isDark = computed === 'dark'
  const label = isDark ? t('theme.light') : t('theme.dark')

  return (
    <Tooltip label={label}>
      <ActionIcon
        variant="default"
        size="lg"
        aria-label={label}
        onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
      >
        {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  )
}
