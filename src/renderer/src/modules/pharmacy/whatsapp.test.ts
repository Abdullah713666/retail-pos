import { describe, expect, it } from 'vitest'
import type { ExpiryRow, WantBookEntry } from '@shared/types'
import { expiryWhatsappText, wantBookWhatsappText } from './whatsapp'

const labels = { title: 'Expiry list', noSupplier: 'No supplier', batch: 'Batch', expires: 'Exp', qty: 'Qty' }
const row = (o: Partial<ExpiryRow>): ExpiryRow => ({
  lotId: 1, itemId: 1, itemName: 'Panadol', unit: 'tablet', lotNo: 'B1', expiryDate: '2026-11-01', daysLeft: 10,
  qtyBase: 20, supplierId: 1, supplierName: 'Hamid', ...o
})

describe('WhatsApp text', () => {
  it('expiry: bold supplier headings, one line per batch, no-supplier group last', () => {
    const text = expiryWhatsappText(
      [row({}), row({ itemName: 'Brufen', lotNo: 'B2', supplierName: null }), row({ itemName: 'Augmentin', lotNo: 'B3' })],
      labels
    )
    expect(text.split('\n')).toEqual([
      '*Expiry list*', '',
      '*Hamid*',
      '- Panadol | Batch B1 | Exp 2026-11-01 | Qty 20 tablet',
      '- Augmentin | Batch B3 | Exp 2026-11-01 | Qty 20 tablet',
      '',
      '*No supplier*',
      '- Brufen | Batch B2 | Exp 2026-11-01 | Qty 20 tablet'
    ])
  })

  it('want-book: grouped by supplier', () => {
    const e = (o: Partial<WantBookEntry>): WantBookEntry => ({
      id: 1, itemId: 1, itemName: 'Panadol', qty: 5, supplierId: 1, supplierName: 'Zaman', source: 'auto', status: 'open', createdAt: '', ...o
    })
    const text = wantBookWhatsappText([e({}), e({ itemName: 'Cough syrup', itemId: null, supplierName: null, qty: 2 })], labels)
    expect(text).toBe('*Expiry list*\n\n*Zaman*\n- Panadol x 5\n\n*No supplier*\n- Cough syrup x 2')
  })
})
