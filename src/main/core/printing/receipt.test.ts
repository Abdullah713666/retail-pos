import { describe, it, expect } from 'vitest'
import { buildReceiptHtml, buildTestPageHtml, type ReceiptData } from './receipt'
import { buildZReportHtml } from './zreport-html'
import { contentMm, paperMicrons } from './html'
import type { ZReport } from '@shared/types'

const base: ReceiptData = {
  shopName: 'Al-Shifa Pharmacy', shopAddress: 'Main Bazar, Lahore', shopPhone: '0300-1234567', footer: 'Thank you, come again',
  invoiceNo: '000042', createdAt: '2026-10-08 14:05:09', cashier: 'Bilal', customer: null,
  lines: [
    { name: 'Panadol <500mg>', qty: 2, unit: 'Strip', unitPrice: 5000, total: 10000 },
    { name: 'Brufen', qty: 1, unit: 'tablet', unitPrice: 1250, total: 1250 }
  ],
  subtotal: 11250, discount: 250, total: 11000, paidCash: 11000, paidCredit: 0, voided: false
}

describe('buildReceiptHtml', () => {
  it('contains header, invoice, date, cashier, lines and totals', () => {
    const h = buildReceiptHtml(base, '80mm', 'en')
    for (const s of ['Al-Shifa Pharmacy', 'Main Bazar, Lahore', '0300-1234567', '000042', '2026-10-08 14:05:09', 'Bilal',
      'Walk-in', '2 Strip x Rs 50.00', 'Rs 100.00', 'Brufen', 'Subtotal', 'Rs 112.50', '- Rs 2.50', 'Rs 110.00', 'Thank you, come again']) {
      expect(h).toContain(s)
    }
  })

  it('escapes HTML in names', () => {
    const h = buildReceiptHtml(base, '80mm', 'en')
    expect(h).toContain('Panadol &lt;500mg&gt;')
    expect(h).not.toContain('<500mg>')
  })

  it('skips subtotal/discount when there is no discount', () => {
    const h = buildReceiptHtml({ ...base, discount: 0, subtotal: 11000 }, '80mm', 'en')
    expect(h).not.toContain('Subtotal')
  })

  it('shows change only when cash received is more than cash due', () => {
    expect(buildReceiptHtml(base, '80mm', 'en')).not.toContain('Change')
    const h = buildReceiptHtml({ ...base, cashReceived: 12000 }, '80mm', 'en')
    expect(h).toContain('Cash received')
    expect(h).toContain('Rs 10.00') // change 1000
  })

  it('shows the credit part, customer and khata balance', () => {
    const h = buildReceiptHtml({ ...base, customer: 'Ali', paidCash: 5000, paidCredit: 6000, khataBalance: 16000 }, '58mm', 'en')
    expect(h).toContain('Ali')
    expect(h).toContain('On credit')
    expect(h).toContain('Khata balance')
    expect(h).toContain('Rs 160.00')
  })

  it('marks voided sales and falls back to a default footer', () => {
    const h = buildReceiptHtml({ ...base, voided: true, footer: '' }, '80mm', 'en')
    expect(h).toContain('VOID')
    expect(h).toContain('Thank you!')
  })

  it('sizes the page for 58 mm and 80 mm', () => {
    expect(buildReceiptHtml(base, '58mm', 'en')).toContain(`width: ${contentMm('58mm')}mm`)
    expect(buildReceiptHtml(base, '80mm', 'en')).toContain(`width: ${contentMm('80mm')}mm`)
    expect(contentMm('58mm')).toBeLessThan(contentMm('80mm'))
    expect(paperMicrons('58mm')).toBe(58000)
    expect(paperMicrons('80mm')).toBe(80000)
  })

  it('renders Urdu labels and names right-to-left', () => {
    const h = buildReceiptHtml({ ...base, shopName: 'الشفا فارمیسی', lines: [{ name: 'پیناڈول', qty: 1, unit: 'گولی', unitPrice: 100, total: 100 }] }, '80mm', 'ur')
    expect(h).toContain('dir="rtl"')
    expect(h).toContain('lang="ur"')
    expect(h).toContain('charset="utf-8"')
    expect(h).toContain('الشفا فارمیسی')
    expect(h).toContain('پیناڈول')
    expect(h).toContain('انوائس')
    expect(h).toContain('ٹوٹل')
  })

  it('English receipts are left-to-right', () => {
    expect(buildReceiptHtml(base, '80mm', 'en')).toContain('dir="ltr"')
  })
})

describe('other printable pages', () => {
  it('test page names the printer and paper', () => {
    const h = buildTestPageHtml('Shop', 'POS-80', '58mm', 'en', '2026-10-08 10:00:00')
    expect(h).toContain('POS-80')
    expect(h).toContain('58mm')
    expect(h).toContain('Test print')
  })

  it('Z report shows the numbers', () => {
    const z: ZReport = {
      shift: { id: 3, userId: 1, userName: 'Bilal', openedAt: 'a', openingCash: 1000, closedAt: 'b', expectedCash: 5000, countedCash: 4900, difference: -100, note: null },
      cash: { openingCash: 1000, cashSales: 4500, cashRefunds: 0, cashIn: 0, cashOut: 0, expenses: 500, supplierPaid: 0, customerPaid: 0, expectedCash: 5000 },
      sales: { count: 2, subtotal: 5000, discount: 100, total: 4900 },
      byPayment: { cash: 4500, credit: 400 },
      returns: { count: 0, total: 0, cash: 0, credit: 0 }, voids: { count: 1, total: 700 },
      entries: [{ id: 1, shiftId: 3, type: 'expense', amount: 500, note: 'tea', userId: 1, userName: 'Bilal', createdAt: 'x' }],
      generatedAt: '2026-10-08 22:00:00'
    }
    const h = buildZReportHtml(z, 'Shop', '80mm', 'en')
    for (const s of ['Day-end (Z) report', '#3', 'Rs 49.00', 'Rs 45.00', 'Rs 4.00', 'Voided invoices', '1 / Rs 7.00', 'tea', 'Rs 50.00', '-Rs 1.00']) {
      expect(h).toContain(s)
    }
  })
})
