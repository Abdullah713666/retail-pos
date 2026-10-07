import React from 'react'
import { Title, Text, Box } from '@mantine/core'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <Box mb="md" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <Title order={2}>{title}</Title>
        {subtitle && <Text c="dimmed" size="sm">{subtitle}</Text>}
      </div>
      {actions && <div>{actions}</div>}
    </Box>
  )
}
