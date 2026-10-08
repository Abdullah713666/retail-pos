import { describe, it, expect } from 'vitest'
import { allocateDiscount, billTotals, lineAmounts, mulDivRoundHalfUp, unitPriceOf } from './sale-calc'

describe('sale-calc', () => {
  it('line amounts: flat and percent discount round half-up', () => {
    expect(lineAmounts(1000, 3, 500, null)).toEqual({ gross: 3000, discount: 500, lineTotal: 2500 })
    // 2.5% of 1001 = 25.025 -> 25 ; 2.5% of 1020 = 25.5 -> 26
    expect(lineAmounts(1001, 1, 0, 250).discount).toBe(25)
    expect(lineAmounts(1020, 1, 0, 250).discount).toBe(26)
    expect(lineAmounts(1, 1, 0, 5000).discount).toBe(1) // 0.5 -> 1
  })

  it('bill discount shares add up exactly to the discount', () => {
    const shares = allocateDiscount([3333, 3333, 3334], 100)
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100)
    expect(allocateDiscount([100, 200], 0)).toEqual([0, 0])
    expect(allocateDiscount([1, 1, 1], 2).reduce((a, b) => a + b, 0)).toBe(2)
  })

  it('bill totals: net totals sum to total', () => {
    const t = billTotals(
      [
        { unitPrice: 1999, qty: 3, discount: 0, discountBp: null },
        { unitPrice: 250, qty: 7, discount: 100, discountBp: null }
      ],
      0,
      1000 // 10%
    )
    expect(t.subtotal).toBe(5997 + 1750)
    expect(t.lineDiscounts).toBe(100)
    const afterLines = 5997 + 1650
    expect(t.billDiscount).toBe(Math.round(afterLines * 0.1)) // 764.7 -> 765
    expect(t.total).toBe(afterLines - t.billDiscount)
    expect(t.netTotals.reduce((a, b) => a + b, 0)).toBe(t.total)
    expect(t.discount).toBe(t.lineDiscounts + t.billDiscount)
  })

  it('pack price: override wins, else base x factor', () => {
    expect(unitPriceOf(50, 10, null)).toBe(500)
    expect(unitPriceOf(50, 10, 450)).toBe(450)
  })

  it('mulDiv rounds half-up without float error', () => {
    expect(mulDivRoundHalfUp(1001, 1, 2)).toBe(501)
    expect(mulDivRoundHalfUp(10, 1, 3)).toBe(3)
  })
})
