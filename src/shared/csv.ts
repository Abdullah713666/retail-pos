import { toPaisa } from './money'
import type { CsvPreviewResult, CsvPreviewRow, CsvImportError } from './types'

/**
 * Splits CSV text into an array of string arrays (rows and fields),
 * taking into account quoted fields, escaped quotes, and CRLF / LF newlines.
 */
export function parseRawCsv(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"'
          i += 2
          continue
        } else {
          inQuotes = false
          i++
          continue
        }
      } else {
        currentField += char
        i++
        continue
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
        continue
      } else if (char === ',') {
        currentRow.push(currentField)
        currentField = ''
        i++
        continue
      } else if (char === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++
        }
        currentRow.push(currentField)
        rows.push(currentRow)
        currentRow = []
        currentField = ''
        i++
        continue
      } else if (char === '\n') {
        currentRow.push(currentField)
        rows.push(currentRow)
        currentRow = []
        currentField = ''
        i++
        continue
      } else {
        currentField += char
        i++
        continue
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  return rows
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, '_')
}

/**
 * Parses and validates CSV content for item import.
 */
export function parseItemsCsv(
  csvContent: string,
  existingBarcodes?: Set<string>
): CsvPreviewResult {
  const rows = parseRawCsv(csvContent)
  const validRows: CsvPreviewRow[] = []
  const errors: CsvImportError[] = []

  if (rows.length === 0) {
    return { totalRows: 0, validRows: [], errors: [] }
  }

  // Parse header
  const rawHeaders = rows[0]
  const headers = rawHeaders.map(normalizeHeader)

  const nameIdx = headers.findIndex((h) => h === 'name' || h === 'item_name')
  const barcodeIdx = headers.findIndex((h) => h === 'barcode' || h === 'code')
  const categoryIdx = headers.findIndex((h) => h === 'category' || h === 'category_name')
  const baseUnitIdx = headers.findIndex((h) => h === 'base_unit' || h === 'unit')
  const salePriceIdx = headers.findIndex((h) => h === 'sale_price' || h === 'price')
  const costPriceIdx = headers.findIndex((h) => h === 'cost_price' || h === 'cost')
  const packNameIdx = headers.findIndex((h) => h === 'pack_name' || h === 'pack')
  const packFactorIdx = headers.findIndex(
    (h) => h === 'pack_factor' || h === 'pack_size' || h === 'factor'
  )

  const seenCsvBarcodes = new Set<string>()

  // Process data rows
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    // Skip empty lines at end of file
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) {
      continue
    }

    const rowNumber = r + 1 // 1-indexed including header
    const rawData: Record<string, string> = {}
    for (let c = 0; c < row.length; c++) {
      const headerName = rawHeaders[c] || `col_${c}`
      rawData[headerName] = row[c] || ''
    }

    // Barcode
    const barcodeRaw = barcodeIdx >= 0 ? (row[barcodeIdx] || '').trim() : ''
    const barcode = barcodeRaw.length > 0 ? barcodeRaw : null
    let barcodeError: string | null = null

    if (barcode) {
      if (seenCsvBarcodes.has(barcode)) {
        barcodeError = `Duplicate barcode "${barcode}" found in CSV`
      } else if (existingBarcodes && existingBarcodes.has(barcode)) {
        barcodeError = `Barcode "${barcode}" already exists in database`
      } else {
        seenCsvBarcodes.add(barcode)
      }
    }

    const name = nameIdx >= 0 ? (row[nameIdx] || '').trim() : ''
    if (!name) {
      errors.push({
        rowNumber,
        field: 'name',
        message: 'Item name is required',
        rawData
      })
      continue
    }

    if (barcodeError) {
      errors.push({
        rowNumber,
        field: 'barcode',
        message: barcodeError,
        rawData
      })
      continue
    }

    // Prices
    const salePriceRaw = salePriceIdx >= 0 ? (row[salePriceIdx] || '').trim() : ''
    let salePrice = 0
    try {
      if (!salePriceRaw) {
        throw new Error('Sale price is required')
      }
      salePrice = toPaisa(salePriceRaw)
      if (salePrice < 0) {
        throw new Error('Sale price cannot be negative')
      }
    } catch {
      errors.push({
        rowNumber,
        field: 'sale_price',
        message: `Invalid sale price: "${salePriceRaw}"`,
        rawData
      })
      continue
    }

    const costPriceRaw = costPriceIdx >= 0 ? (row[costPriceIdx] || '').trim() : ''
    let costPrice = 0
    try {
      if (!costPriceRaw) {
        throw new Error('Cost price is required')
      }
      costPrice = toPaisa(costPriceRaw)
      if (costPrice < 0) {
        throw new Error('Cost price cannot be negative')
      }
    } catch {
      errors.push({
        rowNumber,
        field: 'cost_price',
        message: `Invalid cost price: "${costPriceRaw}"`,
        rawData
      })
      continue
    }

    // Category & Base unit
    const category = categoryIdx >= 0 ? (row[categoryIdx] || '').trim() || null : null
    const baseUnitRaw = baseUnitIdx >= 0 ? (row[baseUnitIdx] || '').trim() : ''
    const baseUnit = baseUnitRaw || 'pc'

    // Packs
    const packName = packNameIdx >= 0 ? (row[packNameIdx] || '').trim() || null : null
    const packFactorRaw = packFactorIdx >= 0 ? (row[packFactorIdx] || '').trim() : ''
    let packFactor: number | null = null

    if (packName) {
      const parsedFactor = parseInt(packFactorRaw, 10)
      if (isNaN(parsedFactor) || parsedFactor < 2) {
        errors.push({
          rowNumber,
          field: 'pack_factor',
          message: `Pack factor must be an integer >= 2 for pack "${packName}"`,
          rawData
        })
        continue
      }
      packFactor = parsedFactor
    }

    validRows.push({
      rowNumber,
      name,
      barcode,
      category,
      baseUnit,
      salePrice,
      costPrice,
      packName,
      packFactor
    })
  }

  return {
    totalRows: validRows.length + errors.length,
    validRows,
    errors
  }
}

/** Escapes one CSV field: quotes when it has a comma, quote or newline. Numbers are written as-is. */
export function csvField(value: string | number): string {
  // Text starting with = + - @ would run as a formula when opened in Excel, so it gets a leading apostrophe.
  const text = typeof value === 'number' ? String(value) : /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Builds CSV text for a table. Starts with a UTF-8 BOM so Excel on Windows shows Urdu correctly,
 * and uses CRLF line endings like Excel does.
 */
export function toCsv(rows: Array<Array<string | number>>): string {
  return '\uFEFF' + rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n'
}
