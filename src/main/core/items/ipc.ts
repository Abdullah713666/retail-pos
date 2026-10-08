import { z } from 'zod'
import { ok } from '@shared/result'
import { handleIpc } from '../../ipc/handle'
import { getDb } from '../../db/connection'
import { checkPermission, getCurrentUser } from '../auth/service'
import {
  listCategories,
  createCategory,
  listItems,
  getItemById,
  searchItems,
  lookupBarcode,
  createItem,
  updateItem,
  deactivateItem,
  reactivateItem,
  previewCsv,
  importCsv
} from './service'

const unitSchema = z.object({
  name: z.string().trim().min(1),
  factor: z.number().int().min(2),
  barcode: z.string().nullable().optional(),
  salePrice: z.number().int().nonnegative().nullable().optional()
})

const createItemSchema = z.object({
  name: z.string().trim().min(1),
  aliases: z.string().optional(),
  barcode: z.string().nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  baseUnit: z.string().trim().min(1),
  salePrice: z.number().int().nonnegative(),
  costPrice: z.number().int().nonnegative(),
  reorderLevel: z.number().int().nonnegative().optional(),
  trackStock: z.boolean().optional(),
  trackLots: z.boolean().optional(),
  units: z.array(unitSchema).optional(),
  openingStock: z
    .object({
      qty: z.number().int().nonnegative()
    })
    .optional()
})

const updateItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  aliases: z.string().optional(),
  barcode: z.string().nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  baseUnit: z.string().trim().min(1),
  salePrice: z.number().int().nonnegative(),
  costPrice: z.number().int().nonnegative(),
  reorderLevel: z.number().int().nonnegative().optional(),
  trackStock: z.boolean().optional(),
  trackLots: z.boolean().optional(),
  units: z.array(unitSchema).optional()
})

const itemFilterSchema = z.object({
  query: z.string().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  activeOnly: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(200).optional()
})

export function registerItemsIpc(): void {
  // Categories
  handleIpc('categories:list', async () => {
    const perm = checkPermission(['cashier', 'manager', 'owner'])
    if (!perm.ok) return perm
    return ok(listCategories(getDb()))
  })

  handleIpc('categories:create', z.string().min(1), async (name) => {
    const perm = checkPermission(['manager', 'owner'])
    if (!perm.ok) return perm
    return createCategory(getDb(), name)
  })

  // Items query & search
  handleIpc('items:list', itemFilterSchema, async (filter) => {
    const perm = checkPermission(['cashier', 'manager', 'owner'])
    if (!perm.ok) return perm
    return ok(listItems(getDb(), filter))
  })

  handleIpc('items:get', z.number().int().positive(), async (id) => {
    const perm = checkPermission(['cashier', 'manager', 'owner'])
    if (!perm.ok) return perm
    return ok(getItemById(getDb(), id))
  })

  handleIpc(
    'items:search',
    z.object({ query: z.string(), limit: z.number().int().positive().max(200).optional() }),
    async ({ query, limit }) => {
      const perm = checkPermission(['cashier', 'manager', 'owner'])
      if (!perm.ok) return perm
      return ok(searchItems(getDb(), query, limit))
    }
  )

  handleIpc('items:lookupBarcode', z.string().min(1), async (barcode) => {
    const perm = checkPermission(['cashier', 'manager', 'owner'])
    if (!perm.ok) return perm
    return ok(lookupBarcode(getDb(), barcode))
  })

  // Items mutations
  handleIpc('items:create', createItemSchema, async (input) => {
    const perm = checkPermission(['manager', 'owner'])
    if (!perm.ok) return perm
    const user = getCurrentUser()
    return createItem(getDb(), input, user?.id)
  })

  handleIpc('items:update', updateItemSchema, async (input) => {
    const perm = checkPermission(['manager', 'owner'])
    if (!perm.ok) return perm
    const user = getCurrentUser()
    return updateItem(getDb(), input, user?.id)
  })

  handleIpc('items:deactivate', z.number().int().positive(), async (id) => {
    const perm = checkPermission(['manager', 'owner'])
    if (!perm.ok) return perm
    const user = getCurrentUser()
    return deactivateItem(getDb(), id, user?.id)
  })

  handleIpc('items:reactivate', z.number().int().positive(), async (id) => {
    const perm = checkPermission(['manager', 'owner'])
    if (!perm.ok) return perm
    const user = getCurrentUser()
    return reactivateItem(getDb(), id, user?.id)
  })

  // CSV
  handleIpc('items:previewCsv', z.string(), async (csvContent) => {
    const perm = checkPermission(['manager', 'owner'])
    if (!perm.ok) return perm
    return previewCsv(getDb(), csvContent)
  })

  handleIpc('items:importCsv', z.string(), async (csvContent) => {
    const perm = checkPermission(['manager', 'owner'])
    if (!perm.ok) return perm
    const user = getCurrentUser()
    return importCsv(getDb(), csvContent, user?.id)
  })
}
