import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Paper, ScrollArea, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'
import type { CompleteSaleResult, Item, Shift } from '@shared/types'
import { callApi } from '../lib/api'
import { getPrintMode, printSaleSafe } from '../lib/print'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useSaleCart } from './sale/useSaleCart'
import { SaleItemSearch } from './sale/SaleItemSearch'
import { SaleLineGrid } from './sale/SaleLineGrid'
import { TotalsPanel } from './sale/TotalsPanel'
import { ShortcutBar } from './sale/ShortcutBar'
import { PaymentDialog } from './sale/PaymentDialog'
import { CustomerDialog } from './sale/CustomerDialog'
import { DiscountDialog, type DiscountValue } from './sale/DiscountDialog'
import { UnitDialog } from './sale/UnitDialog'
import { HeldDialog } from './sale/HeldDialog'
import { InvoicesDialog } from './sale/InvoicesDialog'
import { OpenShiftDialog } from './cash/OpenShiftDialog'

type Dialog = null | 'pay' | 'customer' | 'discount' | 'unit' | 'held' | 'invoices' | 'clear' | 'shift'

export const SaleScreen: React.FC = () => {
  const { t } = useTranslation()
  const searchRef = useRef<HTMLInputElement>(null)
  const sale = useSaleCart()
  const { cart } = sale
  const [dialog, setDialog] = useState<Dialog>(null)
  const [heldCount, setHeldCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [shift, setShift] = useState<Shift | null | undefined>(undefined) // undefined = still loading
  const lastSaleId = useRef<number | null>(null)
  const backToPay = useRef(false) // F3 pressed inside the payment dialog: come back to it

  const refreshHeld = useCallback(async () => {
    const res = await window.api.sales.list({ status: 'held', limit: 200 })
    if (res.ok) setHeldCount(res.data.length)
  }, [])

  const refreshShift = useCallback(async () => {
    const res = await window.api.cash.current()
    if (res.ok) {
      setShift(res.data)
      // No open shift: ask for one right away (selling is blocked until it exists).
      if (res.data === null) setDialog((d) => d ?? 'shift')
    }
  }, [])

  useEffect(() => {
    void refreshHeld()
    void refreshShift()
    searchRef.current?.focus()
  }, [refreshHeld, refreshShift])

  // Give the keyboard back to the search box whenever a dialog closes.
  useEffect(() => {
    if (dialog === null) setTimeout(() => searchRef.current?.focus(), 50)
  }, [dialog])

  const close = useCallback(() => setDialog(null), [])
  const hasLines = cart.lines.length > 0

  const hold = useCallback(async () => {
    if (!hasLines || busy) return
    setBusy(true)
    const res = await callApi(() => window.api.sales.hold(sale.toDraft()))
    setBusy(false)
    if (res) {
      notifications.show({ color: 'green', message: t('sale.held', { id: res.id }) })
      sale.clear()
      void refreshHeld()
    }
  }, [hasLines, busy, sale, refreshHeld, t])

  const recall = useCallback(
    async (id: number) => {
      if (hasLines) {
        notifications.show({ color: 'orange', message: t('sale.finishFirst') })
        return
      }
      const res = await callApi(() => window.api.sales.get(id))
      if (!res) return
      const items: Item[] = []
      for (const itemId of new Set(res.lines.map((l) => l.itemId))) {
        const r = await window.api.items.get(itemId)
        if (r.ok && r.data) items.push(r.data)
      }
      let customer = null
      if (res.partyId != null) {
        const p = await window.api.parties.get(res.partyId)
        if (p.ok) customer = p.data
      }
      sale.load(res, items, customer)
      setDialog(null)
    },
    [hasLines, sale, t]
  )

  const complete = async (paidCash: number, paidCredit: number): Promise<CompleteSaleResult | null> => {
    const res = await callApi(() => window.api.sales.complete({ ...sale.toDraft(), paidCash, paidCredit }))
    if (res) {
      lastSaleId.current = res.sale.id
      sale.clear()
      void refreshHeld()
      // The sale is already saved. Printing is separate and can only ever show a warning toast.
      if ((await getPrintMode()) === 'auto') void printSaleSafe(res.sale.id, paidCash)
    }
    return res
  }

  const reprintLast = useCallback(async () => {
    let id = lastSaleId.current
    if (id === null) {
      const r = await window.api.sales.list({ status: 'completed', limit: 1 })
      id = r.ok && r.data.length > 0 ? r.data[0].id : null
    }
    if (id === null) {
      notifications.show({ color: 'orange', message: t('print.nothingToPrint') })
      return
    }
    if (await printSaleSafe(id)) notifications.show({ color: 'green', message: t('print.sent') })
  }, [t])

  const applyDiscount = (v: DiscountValue): void => {
    if (v.scope === 'line') sale.setLineDiscount(cart.selected, v.discount, v.bp)
    else sale.setBillDiscount(v.discount, v.bp)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (dialog !== null) return
      const map: Record<string, () => void> = {
        F1: () => searchRef.current?.focus(),
        F2: () => hasLines && setDialog('unit'),
        F3: () => setDialog('customer'),
        F4: () => setDialog('discount'),
        F5: () => void hold(),
        F6: () => setDialog('held'),
        F7: () => setDialog('invoices'),
        F8: () => hasLines && setDialog(shift ? 'pay' : 'shift'),
        F9: () => void reprintLast()
      }
      const fn = map[e.key]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, hasLines, hold, shift, reprintLast])

  const selected = cart.lines[cart.selected] ?? null

  return (
    <div style={{ height: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {shift === null && (
        <Alert color="orange" py={6}>
          <Group justify="space-between">
            <Text size="sm">{t('sale.noShift')}</Text>
            <Button size="xs" onClick={() => setDialog('shift')}>{t('cash.openShift')}</Button>
          </Group>
        </Alert>
      )}
      <Group align="stretch" wrap="nowrap" gap="md" style={{ flex: 1, minHeight: 0 }}>
        <Stack gap="xs" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <SaleItemSearch
            inputRef={searchRef}
            onAdd={sale.addItem}
            onMoveLine={(d) => sale.select(cart.selected + d)}
            onQty={(d) => hasLines && sale.changeQty(cart.selected, d)}
            onRemove={() => hasLines && sale.removeLine(cart.selected)}
            onEmptyEnter={() => hasLines && setDialog(shift ? 'pay' : 'shift')}
            onEmptyEscape={() => hasLines && setDialog('clear')}
          />
          <Paper withBorder radius="md" style={{ flex: 1, minHeight: 0 }}>
            <ScrollArea h="100%">
              <SaleLineGrid cart={sale} />
            </ScrollArea>
          </Paper>
        </Stack>
        <Stack gap="xs" w={340}>
          <TotalsPanel cart={sale} heldCount={heldCount} />
          <Button size="xl" disabled={!hasLines} onClick={() => setDialog(shift ? 'pay' : 'shift')}>
            {t('sale.pay')} (F8)
          </Button>
          <Group grow gap="xs">
            <Button variant="light" disabled={!hasLines || busy} onClick={() => void hold()}>{t('sale.hold')} (F5)</Button>
            <Button variant="light" onClick={() => setDialog('held')}>{t('sale.recall')} (F6)</Button>
          </Group>
          <Button variant="default" onClick={() => setDialog('invoices')}>{t('sale.invoices')} (F7)</Button>
          {selected && <Text size="xs" c="dimmed">{selected.item.name}</Text>}
        </Stack>
      </Group>
      <ShortcutBar />

      <OpenShiftDialog opened={dialog === 'shift'} onClose={close} onOpened={setShift} />
      <PaymentDialog
        opened={dialog === 'pay'}
        total={sale.totals.total}
        customer={cart.customer}
        onClose={close}
        onChooseCustomer={() => {
          backToPay.current = true
          setDialog('customer')
        }}
        onConfirm={complete}
        onPrint={(s, cash) => void printSaleSafe(s.id, cash)}
      />
      <CustomerDialog
        opened={dialog === 'customer'}
        onClose={() => {
          setDialog(backToPay.current && hasLines ? 'pay' : null)
          backToPay.current = false
        }} onPick={sale.setCustomer}
      />
      <DiscountDialog opened={dialog === 'discount'} hasLine={hasLines} onClose={close} onApply={applyDiscount} />
      <UnitDialog
        line={dialog === 'unit' ? selected : null}
        onClose={close}
        onApply={(unit, qty) => {
          sale.setUnit(cart.selected, unit)
          sale.setQty(cart.selected, qty)
        }}
      />
      <HeldDialog opened={dialog === 'held'} onClose={close} onRecall={(id) => void recall(id)} onChanged={() => void refreshHeld()} />
      <InvoicesDialog opened={dialog === 'invoices'} onClose={close} />
      <ConfirmDialog
        opened={dialog === 'clear'}
        title={t('sale.clearTitle')}
        message={t('sale.clearAsk')}
        confirmLabel={t('sale.clear')}
        cancelLabel={t('sale.cancel')}
        onCancel={close}
        onConfirm={() => {
          sale.clear()
          close()
        }}
      />
    </div>
  )
}
