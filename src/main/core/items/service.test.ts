import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../db/test-helper'
import {
  createCategory,
  listCategories,
  createItem,
  updateItem,
  deactivateItem,
  reactivateItem,
  getItemById,
  searchItems,
  lookupBarcode,
  listItems,
  previewCsv,
  importCsv
} from './service'

describe('Items & Categories Service', () => {
  describe('Categories', () => {
    it('creates and lists categories alphabetically', () => {
      const db = createTestDb()

      const cat1 = createCategory(db, 'Syrups')
      expect(cat1.ok).toBe(true)
      const cat2 = createCategory(db, 'Antibiotics')
      expect(cat2.ok).toBe(true)

      const list = listCategories(db)
      expect(list).toHaveLength(2)
      expect(list[0].name).toBe('Antibiotics')
      expect(list[1].name).toBe('Syrups')
    })

    it('rejects duplicate categories and reactivates inactive categories', () => {
      const db = createTestDb()
      createCategory(db, 'Tablets')

      const dup = createCategory(db, 'tablets')
      expect(dup.ok).toBe(false)
      if (!dup.ok) {
        expect(dup.error.code).toBe('CATEGORY_EXISTS')
      }

      // Deactivate Tablets
      db.prepare("UPDATE categories SET active = 0 WHERE name = 'Tablets'").run()
      expect(listCategories(db)).toHaveLength(0)

      // Creating it again reactivates it
      const reactivated = createCategory(db, 'Tablets')
      expect(reactivated.ok).toBe(true)
      expect(listCategories(db)).toHaveLength(1)
    })
  })

  describe('Items CRUD', () => {
    it('creates an item with units and opening stock', () => {
      const db = createTestDb()
      const cat = createCategory(db, 'Painkillers')

      const res = createItem(db, {
        name: 'Panadol 500mg',
        aliases: 'paracetamol pain fever',
        barcode: '1234567890',
        categoryId: cat.ok ? cat.data.id : null,
        baseUnit: 'tablet',
        salePrice: 350,
        costPrice: 280,
        reorderLevel: 50,
        units: [
          { name: 'Strip', factor: 10, barcode: '1234567891', salePrice: 3500 },
          { name: 'Box', factor: 200, barcode: '1234567892', salePrice: 70000 }
        ],
        openingStock: { qty: 400 }
      })

      expect(res.ok).toBe(true)
      if (res.ok) {
        const item = res.data
        expect(item.name).toBe('Panadol 500mg')
        expect(item.searchText).toContain('panadol 500mg paracetamol')
        expect(item.salePrice).toBe(350)
        expect(item.stockCache).toBe(400)
        expect(item.units).toHaveLength(2)
        expect(item.units[0].name).toBe('Strip')
        expect(item.units[0].factor).toBe(10)

        // Verify stock movement
        const m = db.prepare('SELECT * FROM stock_movements WHERE item_id = ?').get(item.id) as {
          qty: number
          type: string
        }
        expect(m).toBeDefined()
        expect(m.qty).toBe(400)
        expect(m.type).toBe('opening')

        // Verify audit log
        const audit = db.prepare("SELECT * FROM audit_log WHERE entity = 'items'").get()
        expect(audit).toBeDefined()
      }
    })

    it('rejects duplicate item and unit barcodes', () => {
      const db = createTestDb()

      createItem(db, {
        name: 'Item 1',
        barcode: 'BARCODE1',
        baseUnit: 'pc',
        salePrice: 100,
        costPrice: 80
      })

      // Duplicate item barcode
      const dup1 = createItem(db, {
        name: 'Item 2',
        barcode: 'BARCODE1',
        baseUnit: 'pc',
        salePrice: 200,
        costPrice: 150
      })
      expect(dup1.ok).toBe(false)
      if (!dup1.ok) expect(dup1.error.code).toBe('BARCODE_EXISTS')

      // Unit barcode conflicting with item barcode
      const dup2 = createItem(db, {
        name: 'Item 3',
        barcode: 'BARCODE3',
        baseUnit: 'pc',
        salePrice: 200,
        costPrice: 150,
        units: [{ name: 'Box', factor: 10, barcode: 'BARCODE1' }]
      })
      expect(dup2.ok).toBe(false)
    })

    it('updates item and syncs units', () => {
      const db = createTestDb()
      const created = createItem(db, {
        name: 'Brufen 400mg',
        baseUnit: 'tablet',
        salePrice: 500,
        costPrice: 400,
        units: [{ name: 'Pack', factor: 20 }]
      })
      expect(created.ok).toBe(true)
      const itemId = created.ok ? created.data.id : 0

      const updated = updateItem(db, {
        id: itemId,
        name: 'Brufen 400mg Forte',
        baseUnit: 'tablet',
        salePrice: 550,
        costPrice: 420,
        units: [{ name: 'Box', factor: 100 }]
      })

      expect(updated.ok).toBe(true)
      if (updated.ok) {
        expect(updated.data.name).toBe('Brufen 400mg Forte')
        expect(updated.data.salePrice).toBe(550)
        expect(updated.data.units).toHaveLength(1)
        expect(updated.data.units[0].name).toBe('Box')
        expect(updated.data.units[0].factor).toBe(100)
      }
    })

    it('soft deactivates and reactivates item without deleting business records', () => {
      const db = createTestDb()
      const created = createItem(db, {
        name: 'Disprin',
        baseUnit: 'tablet',
        salePrice: 200,
        costPrice: 150
      })
      const itemId = created.ok ? created.data.id : 0

      expect(deactivateItem(db, itemId).ok).toBe(true)
      expect(getItemById(db, itemId)?.active).toBe(0)

      // Search only returns active items
      expect(searchItems(db, 'Disprin')).toHaveLength(0)

      expect(reactivateItem(db, itemId).ok).toBe(true)
      expect(getItemById(db, itemId)?.active).toBe(1)
      expect(searchItems(db, 'Disprin')).toHaveLength(1)
    })
  })

  describe('Search & Barcode Lookup', () => {
    it('searches by name, alias, and looks up barcodes on item or unit', () => {
      const db = createTestDb()
      createItem(db, {
        name: 'Arinac Forte Syrup',
        aliases: 'cough cold flu',
        barcode: 'ARINAC_BCODE',
        baseUnit: 'bottle',
        salePrice: 12000,
        costPrice: 9500,
        units: [{ name: 'Carton', factor: 24, barcode: 'CARTON_BCODE' }]
      })

      // Search by partial text
      const searchRes = searchItems(db, 'arinac cough')
      expect(searchRes).toHaveLength(1)
      expect(searchRes[0].name).toBe('Arinac Forte Syrup')

      // Lookup by item barcode
      const lookupItem = lookupBarcode(db, 'ARINAC_BCODE')
      expect(lookupItem).toBeDefined()
      expect(lookupItem?.item.name).toBe('Arinac Forte Syrup')
      expect(lookupItem?.unit).toBeNull()

      // Lookup by unit barcode
      const lookupUnit = lookupBarcode(db, 'CARTON_BCODE')
      expect(lookupUnit).toBeDefined()
      expect(lookupUnit?.item.name).toBe('Arinac Forte Syrup')
      expect(lookupUnit?.unit?.name).toBe('Carton')
      expect(lookupUnit?.unit?.factor).toBe(24)
    })

    it('lists items with pagination and filters', () => {
      const db = createTestDb()
      const cat = createCategory(db, 'Category A')
      for (let i = 1; i <= 30; i++) {
        createItem(db, {
          name: `Item ${i}`,
          categoryId: cat.ok ? cat.data.id : null,
          baseUnit: 'pc',
          salePrice: 100 * i,
          costPrice: 80 * i
        })
      }

      const p1 = listItems(db, { page: 1, pageSize: 10 })
      expect(p1.total).toBe(30)
      expect(p1.items).toHaveLength(10)

      const p2 = listItems(db, { page: 2, pageSize: 10 })
      expect(p2.items).toHaveLength(10)
      expect(p2.items[0].name).not.toBe(p1.items[0].name)
    })
  })

  describe('Barcode uniqueness and lots', () => {
    const base = { baseUnit: 'pc', salePrice: 100, costPrice: 50 }

    it('rejects update with a pack barcode used by another item', () => {
      const db = createTestDb()
      createItem(db, { ...base, name: 'A', barcode: '111' })
      const b = createItem(db, { ...base, name: 'B' })
      if (!b.ok) throw new Error('setup')
      const res = updateItem(db, {
        ...base,
        id: b.data.id,
        name: 'B',
        units: [{ name: 'Box', factor: 10, barcode: '111' }]
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.code).toBe('BARCODE_EXISTS')
    })

    it('rejects create with two packs sharing a barcode', () => {
      const db = createTestDb()
      const res = createItem(db, {
        ...base,
        name: 'A',
        units: [
          { name: 'Box', factor: 10, barcode: '222' },
          { name: 'Carton', factor: 100, barcode: '222' }
        ]
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.code).toBe('BARCODE_EXISTS')
    })

    it('allows update to keep its own barcodes', () => {
      const db = createTestDb()
      const a = createItem(db, {
        ...base,
        name: 'A',
        barcode: '333',
        units: [{ name: 'Box', factor: 10, barcode: '334' }]
      })
      if (!a.ok) throw new Error('setup')
      const res = updateItem(db, {
        ...base,
        id: a.data.id,
        name: 'A2',
        barcode: '333',
        units: [{ name: 'Box', factor: 10, barcode: '334' }]
      })
      expect(res.ok).toBe(true)
    })

    it('rejects opening stock for batch items', () => {
      const db = createTestDb()
      const res = createItem(db, {
        ...base,
        name: 'Syrup',
        trackLots: true,
        openingStock: { qty: 10 }
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.code).toBe('LOT_REQUIRED')
      expect(listItems(db, {}).total).toBe(0)
    })
  })

  describe('Search wildcards', () => {
    it('treats % and _ as literal characters', () => {
      const db = createTestDb()
      createItem(db, { name: '50% Off Soap', baseUnit: 'pc', salePrice: 100, costPrice: 50 })
      createItem(db, { name: 'Plain Soap', baseUnit: 'pc', salePrice: 100, costPrice: 50 })
      expect(searchItems(db, '%')).toHaveLength(1)
      expect(searchItems(db, '_')).toHaveLength(0)
      expect(listItems(db, { query: '%' }).total).toBe(1)
      expect(listItems(db, { query: '_' }).total).toBe(0)
    })
  })

  describe('CSV Import & Performance Benchmark', () => {
    it('previews and imports CSV with category creation and packs', () => {
      const db = createTestDb()
      const csv = `name,barcode,category,base_unit,sale_price,cost_price,pack_name,pack_factor
Panadol 500mg,10001,Medicines,tablet,3.50,2.80,Box,200
Arinac Forte,10002,Medicines,tablet,8.00,6.50,Box,100`

      const preview = previewCsv(db, csv)
      expect(preview.ok).toBe(true)
      if (preview.ok) {
        expect(preview.data.totalRows).toBe(2)
        expect(preview.data.errors).toHaveLength(0)

        const importRes = importCsv(db, csv)
        expect(importRes.ok).toBe(true)
        if (importRes.ok) {
          expect(importRes.data.importedCount).toBe(2)
        }
      }

      // Check category was auto-created
      const cats = listCategories(db)
      expect(cats.some((c) => c.name === 'Medicines')).toBe(true)

      // Check items exist and have units
      const item = getItemById(db, 1)
      expect(item?.name).toBe('Panadol 500mg')
      expect(item?.units[0].name).toBe('Box')
      expect(item?.units[0].factor).toBe(200)
    })

    it('re-validates on import: skips rows whose barcode was taken after preview', () => {
      const db = createTestDb()
      const csv = `name,barcode,category,base_unit,sale_price,cost_price,pack_name,pack_factor
Panadol 500mg,10001,Medicines,tablet,3.50,2.80,Box,200
Arinac Forte,10002,Medicines,tablet,8.00,6.50,Box,100
Brufen 400mg,10003,Medicines,tablet,5.00,4.00,Box,100`

      const preview = previewCsv(db, csv)
      expect(preview.ok && preview.data.validRows).toHaveLength(3)

      createItem(db, { name: 'Other', barcode: '10002', baseUnit: 'pc', salePrice: 100, costPrice: 50 })

      const res = importCsv(db, csv)
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.data.importedCount).toBe(2)
        expect(res.data.skippedCount).toBe(1)
      }
      expect(lookupBarcode(db, '10001')?.item.name).toBe('Panadol 500mg')
      expect(lookupBarcode(db, '10002')?.item.name).toBe('Other')
    })

    it('benchmarks: imports 5,000 items in < 10 s and search returns in < 100 ms', () => {
      const db = createTestDb()

      // 1. Generate 5,000 item CSV
      const lines = ['name,barcode,category,base_unit,sale_price,cost_price,pack_name,pack_factor']
      for (let i = 1; i <= 5000; i++) {
        const cat = `Category ${i % 20}`
        lines.push(`Product Item ${i},BAR_${i},${cat},tablet,10.50,8.25,Box,100`)
      }
      const csvString = lines.join('\n')

      // 2. Measure preview + import time
      const startTime = performance.now()
      const preview = previewCsv(db, csvString)
      expect(preview.ok).toBe(true)
      if (!preview.ok) return

      const importRes = importCsv(db, csvString)
      const durationMs = performance.now() - startTime

      expect(importRes.ok).toBe(true)
      if (importRes.ok) {
        expect(importRes.data.importedCount).toBe(5000)
      }

      // TASKS.md requirement: import 5,000 items in < 10 seconds (10,000 ms)
      expect(durationMs).toBeLessThan(10000)

      // 3. Measure search time with 5,000 items in DB
      const searchStart = performance.now()
      const searchResults = searchItems(db, 'Product Item 4500')
      const searchDurationMs = performance.now() - searchStart

      expect(searchResults.length).toBeGreaterThan(0)
      expect(searchResults[0].name).toBe('Product Item 4500')

      // TASKS.md requirement: search returns in < 100 ms
      expect(searchDurationMs).toBeLessThan(100)
    })
  })
})
