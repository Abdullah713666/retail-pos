import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { ok, err, validateAndHandle, safeExecute } from './result'

describe('result helpers', () => {
  it('ok wraps data correctly', () => {
    const res = ok({ value: 42 })
    expect(res).toEqual({ ok: true, data: { value: 42 } })
  })

  it('err wraps error correctly', () => {
    const res = err({ code: 'BAD_REQUEST', message: 'Invalid data' })
    expect(res).toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Invalid data' }
    })
  })

  describe('validateAndHandle', () => {
    const schema = z.object({
      name: z.string().min(2),
      price: z.number().int().positive()
    })

    it('validates valid input and invokes handler', async () => {
      const input = { name: 'Panadol', price: 350 }
      const res = await validateAndHandle(schema, input, async (data) => {
        return ok(`Saved ${data.name} for ${data.price}`)
      })

      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.data).toBe('Saved Panadol for 350')
      }
    })

    it('returns VALIDATION_ERROR when input fails schema', async () => {
      const input = { name: 'P', price: -10 }
      const res = await validateAndHandle(schema, input, async (data) => {
        return ok(data.name)
      })

      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error.code).toBe('VALIDATION_ERROR')
        expect(res.error.message).toContain('name')
      }
    })

    it('catches thrown exceptions and returns INTERNAL_ERROR', async () => {
      const input = { name: 'Panadol', price: 350 }
      const res = await validateAndHandle(schema, input, async () => {
        throw new Error('Database connection failed')
      })

      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error.code).toBe('INTERNAL_ERROR')
        expect(res.error.message).toBe('Database connection failed')
      }
    })
  })

  describe('safeExecute', () => {
    it('returns successful result', async () => {
      const res = await safeExecute(async () => ok('all good'))
      expect(res).toEqual({ ok: true, data: 'all good' })
    })

    it('catches thrown exceptions and returns INTERNAL_ERROR', async () => {
      const res = await safeExecute(async () => {
        throw new Error('Unexpected crash')
      })
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error.code).toBe('INTERNAL_ERROR')
        expect(res.error.message).toBe('Unexpected crash')
      }
    })
  })
})
