export type PaperWidth = '58mm' | '80mm'
export type PrintMode = 'auto' | 'ask' | 'off'

export interface PrinterInfo {
  name: string
  displayName: string
  isDefault: boolean
}

export interface PrintSaleInput {
  saleId: number
  /** Cash handed over, so the receipt can show change. Omitted on a reprint. */
  cashReceived?: number
}

export interface TestPrintInput {
  printerName: string
  paperWidth: PaperWidth
}
