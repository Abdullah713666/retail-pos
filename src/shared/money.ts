// Money helpers (integer paisa)

/**
 * Converts a rupee amount (string or number) to integer paisa.
 * For strings: trims, removes commas, accepts optional '-', digits, optional '.' with <=2 decimals,
 * and converts by splitting on '.' without float multiplication.
 * For numbers: rounds half-up to 2 decimals then converts to paisa.
 * Throws Error('Invalid amount') for empty, NaN, or strings with more than 2 decimal places.
 */
export function toPaisa(input: string | number): number {
  if (typeof input === 'number') {
    if (Number.isNaN(input) || !Number.isFinite(input)) {
      throw new Error('Invalid amount')
    }
    const adjusted = input >= 0 ? input + Number.EPSILON : input - Number.EPSILON
    return Math.round(Number(adjusted.toFixed(2)) * 100)
  }

  if (typeof input === 'string') {
    const s = input.trim().replace(/,/g, '')
    if (!s || !/^-?\d+(\.\d+)?$/.test(s)) {
      throw new Error('Invalid amount')
    }

    const isNegative = s.startsWith('-')
    const absStr = isNegative ? s.slice(1) : s
    const [whole, frac] = absStr.split('.')

    if (frac !== undefined && frac.length > 2) {
      throw new Error('Invalid amount')
    }

    const rupeesPart = parseInt(whole, 10)
    const paisaPart = frac ? parseInt(frac.padEnd(2, '0'), 10) : 0
    const totalPaisa = rupeesPart * 100 + paisaPart

    return isNegative ? -totalPaisa : totalPaisa
  }

  throw new Error('Invalid amount')
}

/**
 * Converts integer paisa to rupees (decimal).
 */
export function fromPaisa(paisa: number): number {
  return paisa / 100
}

/**
 * Rounds a number using standard half-up rounding (>= 0.5 rounds away from zero).
 */
export function roundHalfUp(val: number): number {
  const sign = val < 0 ? -1 : 1
  return sign * Math.floor(Math.abs(val) + 0.5)
}

/**
 * Multiplies a unit price (in paisa) by quantity with half-up rounding.
 * Used for line-level totals.
 */
export function multiplyPrice(pricePaisa: number, qty: number): number {
  return roundHalfUp(pricePaisa * qty)
}

/**
 * Formats integer paisa as standard PKR currency string, e.g. "Rs 1,234.50".
 */
export function formatPKR(paisa: number): string {
  const isNegative = paisa < 0
  const absPaisa = Math.abs(Math.round(paisa))
  const rupees = Math.floor(absPaisa / 100)
  const remPaisa = absPaisa % 100
  const formattedRupees = rupees.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const formattedPaisa = remPaisa.toString().padStart(2, '0')
  const formatted = `Rs ${formattedRupees}.${formattedPaisa}`
  return isNegative ? `-${formatted}` : formatted
}
