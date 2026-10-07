import { describe, it, expect } from 'vitest'
import { toPaisa, fromPaisa, formatPKR, roundHalfUp, multiplyPrice } from './money'

describe('money helpers', () => {
  describe('toPaisa', () => {
    it('converts formatted string "1,234.50" to 123450', () => {
      expect(toPaisa('1,234.50')).toBe(123450)
    })

    it('converts string "0.1" to 10', () => {
      expect(toPaisa('0.1')).toBe(10)
    })

    it('converts number 1.005 to 101 with half-up rounding', () => {
      expect(toPaisa(1.005)).toBe(101)
    })

    it('throws Error("Invalid amount") for string with more than 2 decimals "12.345"', () => {
      expect(() => toPaisa('12.345')).toThrow('Invalid amount')
    })

    it('throws Error("Invalid amount") for non-numeric string "abc"', () => {
      expect(() => toPaisa('abc')).toThrow('Invalid amount')
    })

    it('converts negative string "-5" to -500', () => {
      expect(toPaisa('-5')).toBe(-500)
    })

    it('throws Error("Invalid amount") for empty string and NaN', () => {
      expect(() => toPaisa('')).toThrow('Invalid amount')
      expect(() => toPaisa('   ')).toThrow('Invalid amount')
      expect(() => toPaisa(NaN)).toThrow('Invalid amount')
      expect(() => toPaisa(Infinity)).toThrow('Invalid amount')
    })

    it('converts numbers and simple strings correctly', () => {
      expect(toPaisa(10)).toBe(1000)
      expect(toPaisa(0)).toBe(0)
      expect(toPaisa('0')).toBe(0)
      expect(toPaisa('10')).toBe(1000)
      expect(toPaisa(12.34)).toBe(1234)
      expect(toPaisa('12.34')).toBe(1234)
      expect(toPaisa('-1,234.50')).toBe(-123450)
    })
  })

  describe('fromPaisa', () => {
    it('converts paisa to rupees', () => {
      expect(fromPaisa(1000)).toBe(10)
      expect(fromPaisa(1234)).toBe(12.34)
      expect(fromPaisa(5)).toBe(0.05)
      expect(fromPaisa(0)).toBe(0)
    })
  })

  describe('formatPKR', () => {
    it('formats typical paisa values as "Rs 1,234.50"', () => {
      expect(formatPKR(123450)).toBe('Rs 1,234.50')
    })

    it('formats zero correctly', () => {
      expect(formatPKR(0)).toBe('Rs 0.00')
    })

    it('formats single-digit paisa correctly', () => {
      expect(formatPKR(5)).toBe('Rs 0.05')
    })

    it('formats exact rupee amounts with two decimal places', () => {
      expect(formatPKR(100)).toBe('Rs 1.00')
    })

    it('formats large values with comma thousands separators', () => {
      expect(formatPKR(100000000)).toBe('Rs 1,000,000.00')
    })

    it('formats negative amounts correctly', () => {
      expect(formatPKR(-123450)).toBe('-Rs 1,234.50')
    })
  })

  describe('roundHalfUp', () => {
    it('rounds positive numbers half-up', () => {
      expect(roundHalfUp(10.4)).toBe(10)
      expect(roundHalfUp(10.5)).toBe(11)
      expect(roundHalfUp(10.6)).toBe(11)
      expect(roundHalfUp(0.5)).toBe(1)
      expect(roundHalfUp(0.49)).toBe(0)
    })

    it('rounds negative numbers half-up (away from zero on 0.5)', () => {
      expect(roundHalfUp(-10.4)).toBe(-10)
      expect(roundHalfUp(-10.5)).toBe(-11)
      expect(roundHalfUp(-10.6)).toBe(-11)
    })
  })

  describe('multiplyPrice', () => {
    it('multiplies integer unit price by integer quantity', () => {
      expect(multiplyPrice(100, 3)).toBe(300)
      expect(multiplyPrice(350, 4)).toBe(1400)
    })

    it('multiplies with fractional quantity and applies half-up rounding', () => {
      // 333 * 0.5 = 166.5 -> 167
      expect(multiplyPrice(333, 0.5)).toBe(167)
      // 333 * 0.49 = 163.17 -> 163
      expect(multiplyPrice(333, 0.49)).toBe(163)
    })
  })
})
