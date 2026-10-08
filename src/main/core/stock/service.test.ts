import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import { createItem, getItemById } from '../items/service'
import { findOrCreateLot, getItemStock, getLotStock, postMovement } from './service'

function setup(): { db: ReturnType<typeof createTestDb>; itemId: number } {
  const db = createTestDb()
  const res = createItem(db, { name: 'Panadol', baseUnit: 'tablet', salePrice: 5, costPrice: 3, trackLots: true })
  if (!res.ok) throw new Error(res.error.message)
  return { db, itemId: res.data.id }
}

describe('Stock service', () => {
  it('posts movements and keeps stock_cache equal to the movement sum', () => {
    const { db, itemId } = setup()
    const lot = findOrCreateLot(db, { itemId, lotNo: 'A', expiryDate: '2027-01-01', costPrice: 3 })
    if (!lot.ok) throw new Error('lot')
    expect(postMovement(db, { itemId, lotId: lot.data, qty: 50, type: 'purchase' }).ok).toBe(true)
    expect(postMovement(db, { itemId, lotId: lot.data, qty: -20, type: 'sale' }).ok).toBe(true)
    expect(getItemStock(db, itemId)).toBe(30)
    expect(getLotStock(db, lot.data)).toBe(30)
    expect(getItemById(db, itemId)!.stockCache).toBe(30)
  })

  it('refuses negative stock (item or lot) unless allowNegative, and zero/fractional qty', () => {
    const { db, itemId } = setup()
    const a = findOrCreateLot(db, { itemId, lotNo: 'A', expiryDate: null, costPrice: 3 })
    const b = findOrCreateLot(db, { itemId, lotNo: 'B', expiryDate: null, costPrice: 3 })
    if (!a.ok || !b.ok) throw new Error('lot')
    postMovement(db, { itemId, lotId: a.data, qty: 10, type: 'purchase' })
    postMovement(db, { itemId, lotId: b.data, qty: 10, type: 'purchase' })
    // item has 20 but lot A only 10
    expect(postMovement(db, { itemId, lotId: a.data, qty: -11, type: 'sale' })).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_STOCK' } })
    expect(postMovement(db, { itemId, qty: -21, type: 'sale' })).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_STOCK' } })
    expect(postMovement(db, { itemId, qty: 0, type: 'adjust' })).toMatchObject({ ok: false, error: { code: 'INVALID_QTY' } })
    expect(postMovement(db, { itemId, qty: 1.5, type: 'adjust' })).toMatchObject({ ok: false, error: { code: 'INVALID_QTY' } })
    expect(postMovement(db, { itemId, qty: -25, type: 'sale', allowNegative: true }).ok).toBe(true)
    expect(getItemById(db, itemId)!.stockCache).toBe(-5)
  })
})
