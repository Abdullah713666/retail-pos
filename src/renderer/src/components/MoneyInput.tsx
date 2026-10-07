import React from 'react'
import { TextInput, TextInputProps } from '@mantine/core'

export const MoneyInput: React.FC<TextInputProps> = (props) => {
  return <TextInput {...props} placeholder="0.00" />
}
