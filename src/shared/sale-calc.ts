// Sale money math (integer paisa). Used by main (authoritative) and the renderer (preview only),
// so both always agree. Uses BigInt for products that could pass 2^53.

/** round-half-up of a / b for a >= 0, b > 0. */
export function divRoundHalfUp(a: number, b: number): number {
  const A = BigInt(a)
  const B = BigInt(b)
  return Number((2n * A + B) / (2n * B))
}

/** round-half-up of a * b / c for non-negative integers (product computed exactly). */
export function mulDivRoundHalfUp(a: number, b: number, c: number): number {
  return Number((2n * BigInt(a) * BigInt(b) + BigInt(c)) / (2n * BigInt(c)))
}

export interface LineAmounts {
  gross: number // unitPrice * qty
  discount: number
  lineTotal: number // gross - discount
}

export function lineAmounts(
  unitPrice: number,
  qty: number,
  discount: number,
  discountBp: number | null
): LineAmounts {
  const gross = unitPrice * qty
  const disc = discountBp != null ? percentOf(gross, discountBp) : discount
  return { gross, discount: disc, lineTotal: gross - disc }
}

/** Percent (basis points: 250 = 2.5%) of an amount, rounded half-up. */
export function percentOf(amount: number, bp: number): number {
  return Number((2n * BigInt(amount) * BigInt(bp) + 10000n) / 20000n)
}

/**
 * Splits a bill-level discount across lines in proportion to their line totals
 * (largest remainder, so the shares add up to exactly `discount`).
 */
export function allocateDiscount(lineTotals: number[], discount: number): number[] {
  const sum = lineTotals.reduce((a, b) => a + b, 0)
  if (discount <= 0 || sum <= 0) return lineTotals.map(() => 0)
  const D = BigInt(discount)
  const S = BigInt(sum)
  const shares = lineTotals.map((lt) => (D * BigInt(lt)) / S)
  const rems = lineTotals.map((lt, i) => ({ i, r: (D * BigInt(lt)) % S }))
  let left = Number(D - shares.reduce((a, b) => a + b, 0n))
  rems.sort((x, y) => (x.r === y.r ? x.i - y.i : x.r > y.r ? -1 : 1))
  const out = shares.map((s) => Number(s))
  for (const { i } of rems) {
    if (left <= 0) break
    out[i] += 1
    left -= 1
  }
  return out
}

/** Price of one `unit` pack: the pack override, else base price x factor. */
export function unitPriceOf(basePrice: number, factor: number, packPrice: number | null): number {
  return packPrice ?? basePrice * factor
}

export interface BillTotals {
  subtotal: number // sum of gross
  lineDiscounts: number
  billDiscount: number
  discount: number // lineDiscounts + billDiscount
  total: number
  netTotals: number[] // per line, after bill discount share
}

export interface TotalsLine {
  unitPrice: number
  qty: number
  discount: number
  discountBp: number | null
}

export function billTotals(
  lines: TotalsLine[],
  billDiscount: number,
  billDiscountBp: number | null
): BillTotals {
  const amounts = lines.map((l) => lineAmounts(l.unitPrice, l.qty, l.discount, l.discountBp))
  const afterLines = amounts.reduce((s, a) => s + a.lineTotal, 0)
  const bill = billDiscountBp != null ? percentOf(afterLines, billDiscountBp) : billDiscount
  const shares = allocateDiscount(
    amounts.map((a) => a.lineTotal),
    bill
  )
  const subtotal = amounts.reduce((s, a) => s + a.gross, 0)
  const lineDiscounts = amounts.reduce((s, a) => s + a.discount, 0)
  return {
    subtotal,
    lineDiscounts,
    billDiscount: bill,
    discount: lineDiscounts + bill,
    total: afterLines - bill,
    netTotals: amounts.map((a, i) => a.lineTotal - shares[i])
  }
}
