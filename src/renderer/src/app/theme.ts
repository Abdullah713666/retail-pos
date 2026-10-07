import { createTheme } from '@mantine/core'

export const theme = createTheme({
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem', // 16px base font
    lg: '1.125rem',
    xl: '1.25rem'
  },
  primaryColor: 'blue'
})
