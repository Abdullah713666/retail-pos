import React from 'react'
import { TextInput, TextInputProps } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'

export const ItemSearch: React.FC<TextInputProps> = (props) => {
  return (
    <TextInput
      leftSection={<IconSearch size={16} />}
      placeholder="Search item by name, barcode... (F1)"
      {...props}
    />
  )
}
