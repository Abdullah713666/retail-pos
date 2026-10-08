/**
 * Receipt/report labels. Receipts are built in the main process (no react-i18next there), so the
 * two languages live here. Keep keys identical in both.
 */
export type Lang = 'en' | 'ur'

const EN = {
  invoice: 'Invoice', date: 'Date', cashier: 'Cashier', customer: 'Customer', walkIn: 'Walk-in',
  subtotal: 'Subtotal', discount: 'Discount', total: 'TOTAL', paidCash: 'Paid cash', onCredit: 'On credit (khata)',
  cashReceived: 'Cash received', change: 'Change', khataBalance: 'Khata balance', voided: '*** VOID ***',
  thanks: 'Thank you!', testTitle: 'Test print', testOk: 'If you can read this, the printer works.',
  paper: 'Paper', printer: 'Printer',
  zTitle: 'Day-end (Z) report', zOpen: 'Shift still open (not final)', shift: 'Shift', openedBy: 'Opened by',
  opened: 'Opened', closed: 'Closed', sales: 'Sales', invoices: 'Invoices', grossSales: 'Gross sales',
  discounts: 'Discounts', netSales: 'Net sales', byPayment: 'By payment type', cash: 'Cash', credit: 'Credit (khata)',
  returns: 'Returns', returnsCash: 'Returns paid in cash', voids: 'Voided invoices', cashDrawer: 'Cash drawer',
  opening: 'Opening cash', cashSales: 'Cash sales', cashRefunds: 'Cash refunds', cashIn: 'Cash in',
  cashOut: 'Cash out', expenses: 'Expenses', supplierPaid: 'Paid to suppliers', customerPaid: 'Khata received',
  expected: 'Expected cash', counted: 'Counted cash', difference: 'Difference', entries: 'Cash entries',
  noteLabel: 'Note', signature: 'Signature'
}

const UR: typeof EN = {
  invoice: 'انوائس', date: 'تاریخ', cashier: 'کیشیئر', customer: 'گاہک', walkIn: 'عام گاہک',
  subtotal: 'کل رقم', discount: 'رعایت', total: 'ٹوٹل', paidCash: 'نقد ادا', onCredit: 'ادھار (کھاتہ)',
  cashReceived: 'وصول شدہ نقد', change: 'باقی رقم', khataBalance: 'کھاتہ بیلنس', voided: '*** منسوخ ***',
  thanks: 'شکریہ!', testTitle: 'ٹیسٹ پرنٹ', testOk: 'اگر آپ یہ پڑھ سکتے ہیں تو پرنٹر ٹھیک چل رہا ہے۔',
  paper: 'کاغذ', printer: 'پرنٹر',
  zTitle: 'دن کے اختتام کی (Z) رپورٹ', zOpen: 'شفٹ ابھی کھلی ہے (حتمی نہیں)', shift: 'شفٹ', openedBy: 'کھولنے والا',
  opened: 'کھلی', closed: 'بند', sales: 'سیل', invoices: 'انوائسز', grossSales: 'کل سیل',
  discounts: 'رعایتیں', netSales: 'خالص سیل', byPayment: 'ادائیگی کی قسم', cash: 'نقد', credit: 'ادھار (کھاتہ)',
  returns: 'واپسی', returnsCash: 'نقد واپس کی گئی', voids: 'منسوخ انوائسز', cashDrawer: 'کیش دراز',
  opening: 'ابتدائی نقد', cashSales: 'نقد سیل', cashRefunds: 'نقد واپسی', cashIn: 'نقد اندر',
  cashOut: 'نقد باہر', expenses: 'اخراجات', supplierPaid: 'سپلائرز کو ادا', customerPaid: 'کھاتے میں وصول',
  expected: 'متوقع نقد', counted: 'گنتی شدہ نقد', difference: 'فرق', entries: 'کیش اندراجات',
  noteLabel: 'نوٹ', signature: 'دستخط'
}

export type Labels = typeof EN

export function labelsFor(lang: Lang): Labels {
  return lang === 'ur' ? UR : EN
}
