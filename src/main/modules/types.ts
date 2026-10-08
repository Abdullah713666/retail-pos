import type Database from 'better-sqlite3'
import type { Migration } from '../db/migrate'

export interface ModuleContext {
  db: Database.Database
}

/** Extra facts for one allocation. `overrideBy` = owner who approved selling blocked stock. */
export interface AllocateContext {
  saleId?: number
  userId?: number
  overrideBy?: number | null
}

export interface StockAllocator {
  // Decide which lots a sale line consumes. Default core allocator: no lots / oldest lot first.
  // May throw TxAbort (db/tx) to block a sale; code 'OWNER_OVERRIDE_REQUIRED' asks the screen for an owner PIN.
  allocate(
    db: Database.Database,
    itemId: number,
    qtyBase: number,
    ctx?: AllocateContext
  ): Array<{ lotId: number | null; qtyBase: number }>
}

export interface MainModule {
  id: string // 'pharmacy'
  migrations: Migration[] // SQL imported with Vite '?raw'
  registerIpc(ctx: ModuleContext): void
  stockAllocator?: StockAllocator // overrides how sales pick lots
  onSaleCompleted?(ctx: ModuleContext, saleId: number): void // runs inside the sale transaction
  /** Runs inside the item create/update transaction with the module's own form data (validate it; throw TxAbort to reject). */
  onItemSaved?(ctx: ModuleContext, itemId: number, data: Record<string, unknown>, userId: number | null): void
}
