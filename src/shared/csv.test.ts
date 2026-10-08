import { describe, it, expect } from 'vitest'
import { parseRawCsv, parseItemsCsv, toCsv } from './csv'

describe('CSV Parser', () => {
  it('parses raw CSV with commas and quotes', () => {
    const csv = 'name,price,note\n"Panadol, Extra",10.50,"Best ""medicine"""\nDisprin,2.00,Painkiller'
    const rows = parseRawCsv(csv)

    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual(['name', 'price', 'note'])
    expect(rows[1]).toEqual(['Panadol, Extra', '10.50', 'Best "medicine"'])
    expect(rows[2]).toEqual(['Disprin', '2.00', 'Painkiller'])
  })

  it('correctly parses and validates sample items CSV', () => {
    const csv = `name,barcode,category,base_unit,sale_price,cost_price,pack_name,pack_factor
Panadol 500mg,10001,Medicines,tablet,3.50,2.80,Box,200
Arinac Forte,10002,Medicines,tablet,8.00,6.50,Box,100`

    const res = parseItemsCsv(csv)
    expect(res.totalRows).toBe(2)
    expect(res.errors).toHaveLength(0)
    expect(res.validRows).toHaveLength(2)

    expect(res.validRows[0]).toEqual({
      rowNumber: 2,
      name: 'Panadol 500mg',
      barcode: '10001',
      category: 'Medicines',
      baseUnit: 'tablet',
      salePrice: 350,
      costPrice: 280,
      packName: 'Box',
      packFactor: 200
    })
  })

  it('detects invalid rows and errors', () => {
    const csv = `name,barcode,category,base_unit,sale_price,cost_price,pack_name,pack_factor
,10001,Medicines,tablet,3.50,2.80,,
Panadol,10002,Medicines,tablet,invalid_price,2.80,,
Brufen,10003,Medicines,tablet,5.00,4.00,Box,not_a_number
Disprin,10001,Medicines,tablet,2.00,1.50,,`

    const res = parseItemsCsv(csv)
    expect(res.validRows).toHaveLength(0)
    expect(res.errors).toHaveLength(4)
    expect(res.errors[0].field).toBe('name')
    expect(res.errors[1].field).toBe('sale_price')
    expect(res.errors[2].field).toBe('pack_factor')
    expect(res.errors[3].field).toBe('barcode')
  })

  it('detects existing database barcodes', () => {
    const csv = `name,barcode,category,base_unit,sale_price,cost_price,pack_name,pack_factor
Panadol,EXISTING1,Medicines,tablet,3.50,2.80,,`

    const existing = new Set(['EXISTING1'])
    const res = parseItemsCsv(csv, existing)
    expect(res.validRows).toHaveLength(0)
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0].field).toBe('barcode')
    expect(res.errors[0].message).toContain('already exists')
  })
})

describe('CSV writer', () => {
  it('starts with a BOM, escapes quotes, commas and newlines, and round-trips', () => {
    const rows: Array<Array<string | number>> = [
      ['name', 'amount'],
      ['Panadol, "Extra"', 12.5],
      ['line1\nline2', 0],
      ['پنادول', 3]
    ]
    const text = toCsv(rows)
    expect(text.charCodeAt(0)).toBe(0xfeff)
    const back = parseRawCsv(text.slice(1))
    expect(back).toEqual(rows.map((r) => r.map(String)))
  })

  it('neutralises spreadsheet formulas in text but not in numbers', () => {
    const text = toCsv([['=SUM(A1)', -5]])
    expect(text.slice(1)).toBe("'=SUM(A1),-5\r\n")
  })
})
