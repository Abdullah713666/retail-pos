import type Database from 'better-sqlite3'
import type { Migration } from '../db/migrate'

export interface ModuleContext {
  db: Database.Database
}

export interface StockAllocator {
  // Decide which lots a sale line consumes. Default core allocator: no lots / oldest lot first.
  allocate(
    db: Database.Database,
    itemId: number,
    qtyBase: number
  ): Array<{ lotId: number | null; qtyBase: number }>
}

export interface MainModule {
  id: string // 'pharmacy'
  migrations: Migration[] // SQL imported with Vite '?raw'
  registerIpc(ctx: ModuleContext): void
  stockAllocator?: StockAllocator // overrides how sales pick lots
  onSaleCompleted?(ctx: ModuleContext, saleId: number): void // runs inside the sale transaction
}
