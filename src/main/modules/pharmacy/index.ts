import type { MainModule, ModuleContext } from '../types'
import pharmacyMigration001 from './migrations/001_pharmacy.sql?raw'
import pharmacyMigration002 from './migrations/002_want_book.sql?raw'
import { fefoAllocator } from './fefo'
import { registerPharmacyIpc } from './ipc'
import { autoAddForSale } from './wantbook'
import { saveItemInfo } from './info'

export const pharmacyMainModule: MainModule = {
  id: 'pharmacy',
  migrations: [
    { id: 'pharmacy/001_init', sql: pharmacyMigration001 },
    { id: 'pharmacy/002_want_book', sql: pharmacyMigration002 }
  ],
  registerIpc(_ctx: ModuleContext): void {
    registerPharmacyIpc()
  },
  stockAllocator: fefoAllocator,
  onSaleCompleted(ctx, saleId) {
    autoAddForSale(ctx.db, saleId)
  },
  onItemSaved(ctx, itemId, data) {
    saveItemInfo(ctx.db, itemId, data)
  }
}
