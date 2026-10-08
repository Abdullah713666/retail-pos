import { useCallback, useMemo, useRef, useState } from 'react'
import { billTotals, unitPriceOf, type BillTotals } from '@shared/sale-calc'
import type { Item, ItemUnit, Party, Sale, SaleDraftInput } from '@shared/types'

/** One line on screen. Prices here are a PREVIEW; main recomputes everything on save. */
export interface CartLine {
  key: number
  item: Item
  unit: ItemUnit | null // null = base unit
  qty: number
  discount: number // paisa
  discountBp: number | null
}

export interface Cart {
  lines: CartLine[]
  customer: Party | null
  billDiscount: number
  billDiscountBp: number | null
  heldSaleId: number | null
  selected: number // index of the highlighted line
}

const EMPTY: Cart = { lines: [], customer: null, billDiscount: 0, billDiscountBp: null, heldSaleId: null, selected: 0 }

export function lineUnitPrice(l: CartLine): number {
  return unitPriceOf(l.item.salePrice, l.unit?.factor ?? 1, l.unit?.salePrice ?? null)
}

export function lineFactor(l: CartLine): number {
  return l.unit?.factor ?? 1
}

export interface SaleCart {
  cart: Cart
  totals: BillTotals
  addItem: (item: Item, unit: ItemUnit | null) => void
  setQty: (index: number, qty: number) => void
  changeQty: (index: number, delta: number) => void
  setUnit: (index: number, unit: ItemUnit | null) => void
  removeLine: (index: number) => void
  select: (index: number) => void
  setLineDiscount: (index: number, discount: number, bp: number | null) => void
  setBillDiscount: (discount: number, bp: number | null) => void
  setCustomer: (c: Party | null) => void
  clear: () => void
  load: (sale: Sale, items: Item[], customer: Party | null) => void
  toDraft: () => SaleDraftInput
}

export function useSaleCart(): SaleCart {
  const [cart, setCart] = useState<Cart>(EMPTY)
  const keySeq = useRef(0)

  const totals = useMemo(
    () =>
      billTotals(
        cart.lines.map((l) => ({ unitPrice: lineUnitPrice(l), qty: l.qty, discount: l.discount, discountBp: l.discountBp })),
        cart.billDiscount,
        cart.billDiscountBp
      ),
    [cart]
  )

  const patchLine = useCallback((index: number, fn: (l: CartLine) => CartLine) => {
    setCart((c) => ({ ...c, lines: c.lines.map((l, i) => (i === index ? fn(l) : l)) }))
  }, [])

  const addItem = useCallback((item: Item, unit: ItemUnit | null) => {
    setCart((c) => {
      const at = c.lines.findIndex(
        (l) => l.item.id === item.id && (l.unit?.id ?? null) === (unit?.id ?? null) && l.discount === 0 && l.discountBp == null
      )
      if (at >= 0) {
        return { ...c, selected: at, lines: c.lines.map((l, i) => (i === at ? { ...l, qty: l.qty + 1 } : l)) }
      }
      const line: CartLine = { key: ++keySeq.current, item, unit, qty: 1, discount: 0, discountBp: null }
      return { ...c, lines: [...c.lines, line], selected: c.lines.length }
    })
  }, [])

  return {
    cart,
    totals,
    addItem,
    setQty: (index, qty) => patchLine(index, (l) => ({ ...l, qty: Math.max(1, Math.floor(qty)) })),
    changeQty: (index, delta) => patchLine(index, (l) => ({ ...l, qty: Math.max(1, l.qty + delta) })),
    setUnit: (index, unit) => patchLine(index, (l) => ({ ...l, unit })),
    removeLine: (index) =>
      setCart((c) => {
        const lines = c.lines.filter((_, i) => i !== index)
        return { ...c, lines, selected: Math.min(c.selected, Math.max(lines.length - 1, 0)) }
      }),
    select: (index) => setCart((c) => ({ ...c, selected: Math.min(Math.max(index, 0), Math.max(c.lines.length - 1, 0)) })),
    setLineDiscount: (index, discount, bp) => patchLine(index, (l) => ({ ...l, discount, discountBp: bp })),
    setBillDiscount: (discount, bp) => setCart((c) => ({ ...c, billDiscount: discount, billDiscountBp: bp })),
    setCustomer: (customer) => setCart((c) => ({ ...c, customer })),
    clear: () => setCart(EMPTY),
    load: (sale, items, customer) => {
      const byId = new Map(items.map((i) => [i.id, i]))
      const lines: CartLine[] = []
      for (const l of sale.lines) {
        const item = byId.get(l.itemId)
        if (!item) continue
        lines.push({
          key: ++keySeq.current,
          item,
          unit: item.units.find((u) => u.id === l.unitId) ?? null,
          qty: l.qty,
          discount: l.discount,
          discountBp: l.discountBp
        })
      }
      setCart({
        lines,
        customer,
        billDiscount: sale.billDiscount,
        billDiscountBp: sale.billDiscountBp,
        heldSaleId: sale.id,
        selected: 0
      })
    },
    toDraft: () => ({
      partyId: cart.customer?.id ?? null,
      heldSaleId: cart.heldSaleId,
      billDiscount: cart.billDiscountBp == null ? cart.billDiscount : 0,
      billDiscountBp: cart.billDiscountBp,
      lines: cart.lines.map((l) => ({
        itemId: l.item.id,
        unitId: l.unit?.id ?? null,
        qty: l.qty,
        discount: l.discountBp == null ? l.discount : 0,
        discountBp: l.discountBp
      }))
    })
  }
}
