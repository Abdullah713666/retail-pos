import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/ipc-contract'
import type {
  CreateUserInput,
  LoginInput,
  SetupCompleteInput,
  CreateItemInput,
  UpdateItemInput,
  ItemFilter,
  PartyFilter,
  CreatePartyInput,
  UpdatePartyInput,
  StatementInput,
  RecordPaymentInput,
  CreatePurchaseInput,
  PurchaseFilter,
  PurchaseReturnInput,
  SaleDraftInput,
  CompleteSaleInput,
  SaleFilter,
  SaleReturnInput,
  VoidSaleInput,
  OpenShiftInput,
  CashEntryInput,
  CloseShiftInput,
  PrintSaleInput,
  TestPrintInput,
  SalesReportInput,
  SaveCsvInput,
  RestoreInput,
  ExpiryFilter,
  WantBookAddInput,
  WantStatus
} from '../shared/types'

const api: IpcApi = {
  ping: () => ipcRenderer.invoke('ping'),
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },
  db: {
    getMigrationStatus: () => ipcRenderer.invoke('db:getMigrationStatus')
  },
  setup: {
    complete: (input: SetupCompleteInput) => ipcRenderer.invoke('setup:complete', input)
  },
  pharmacy: {
    getItemInfo: (itemId: number) => ipcRenderer.invoke('pharmacy:getItemInfo', itemId),
    previewAllocation: (input: { itemId: number; qtyBase: number }) =>
      ipcRenderer.invoke('pharmacy:previewAllocation', input),
    listExpiry: (filter: ExpiryFilter) => ipcRenderer.invoke('pharmacy:listExpiry', filter),
    wantBookList: (status: WantStatus | 'active') => ipcRenderer.invoke('pharmacy:wantBook:list', status),
    wantBookAdd: (input: WantBookAddInput) => ipcRenderer.invoke('pharmacy:wantBook:add', input),
    wantBookSetStatus: (input: { id: number; status: WantStatus }) =>
      ipcRenderer.invoke('pharmacy:wantBook:setStatus', input),
    dashboard: () => ipcRenderer.invoke('pharmacy:dashboard')
  },
  modules: {
    getEnabled: () => ipcRenderer.invoke('modules:getEnabled'),
    setEnabled: (moduleIds: string[]) => ipcRenderer.invoke('modules:setEnabled', moduleIds)
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (input: { key: string; value: string }) => ipcRenderer.invoke('settings:set', input),
    setMany: (settings: Record<string, string>) => ipcRenderer.invoke('settings:setMany', settings)
  },
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    create: (input: CreateUserInput) => ipcRenderer.invoke('users:create', input),
    deactivate: (id: number) => ipcRenderer.invoke('users:deactivate', id)
  },
  auth: {
    login: (input: LoginInput) => ipcRenderer.invoke('auth:login', input),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    hasUsers: () => ipcRenderer.invoke('auth:hasUsers')
  },
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (name: string) => ipcRenderer.invoke('categories:create', name)
  },
  items: {
    list: (filter: ItemFilter) => ipcRenderer.invoke('items:list', filter),
    get: (id: number) => ipcRenderer.invoke('items:get', id),
    search: (query: string, limit?: number) => ipcRenderer.invoke('items:search', { query, limit }),
    lookupBarcode: (barcode: string) => ipcRenderer.invoke('items:lookupBarcode', barcode),
    create: (input: CreateItemInput) => ipcRenderer.invoke('items:create', input),
    update: (input: UpdateItemInput) => ipcRenderer.invoke('items:update', input),
    deactivate: (id: number) => ipcRenderer.invoke('items:deactivate', id),
    reactivate: (id: number) => ipcRenderer.invoke('items:reactivate', id),
    previewCsv: (csvContent: string) => ipcRenderer.invoke('items:previewCsv', csvContent),
    importCsv: (csvContent: string) => ipcRenderer.invoke('items:importCsv', csvContent)
  },
  parties: {
    list: (filter: PartyFilter) => ipcRenderer.invoke('parties:list', filter),
    get: (id: number) => ipcRenderer.invoke('parties:get', id),
    create: (input: CreatePartyInput) => ipcRenderer.invoke('parties:create', input),
    update: (input: UpdatePartyInput) => ipcRenderer.invoke('parties:update', input),
    deactivate: (id: number) => ipcRenderer.invoke('parties:deactivate', id),
    reactivate: (id: number) => ipcRenderer.invoke('parties:reactivate', id)
  },
  ledger: {
    statement: (input: StatementInput) => ipcRenderer.invoke('ledger:statement', input),
    recordPayment: (input: RecordPaymentInput) => ipcRenderer.invoke('ledger:recordPayment', input)
  },
  purchases: {
    list: (filter: PurchaseFilter) => ipcRenderer.invoke('purchases:list', filter),
    get: (id: number) => ipcRenderer.invoke('purchases:get', id),
    create: (input: CreatePurchaseInput) => ipcRenderer.invoke('purchases:create', input),
    return: (input: PurchaseReturnInput) => ipcRenderer.invoke('purchases:return', input)
  },
  sales: {
    complete: (input: CompleteSaleInput) => ipcRenderer.invoke('sales:complete', input),
    hold: (input: SaleDraftInput) => ipcRenderer.invoke('sales:hold', input),
    discardHeld: (id: number) => ipcRenderer.invoke('sales:discardHeld', id),
    list: (filter: SaleFilter) => ipcRenderer.invoke('sales:list', filter),
    get: (id: number) => ipcRenderer.invoke('sales:get', id),
    getByInvoice: (invoiceNo: string) => ipcRenderer.invoke('sales:getByInvoice', invoiceNo),
    return: (input: SaleReturnInput) => ipcRenderer.invoke('sales:return', input),
    void: (input: VoidSaleInput) => ipcRenderer.invoke('sales:void', input)
  },
  cash: {
    current: () => ipcRenderer.invoke('cash:current'),
    open: (input: OpenShiftInput) => ipcRenderer.invoke('cash:open', input),
    addEntry: (input: CashEntryInput) => ipcRenderer.invoke('cash:addEntry', input),
    close: (input: CloseShiftInput) => ipcRenderer.invoke('cash:close', input),
    detail: (shiftId: number) => ipcRenderer.invoke('cash:detail', shiftId),
    list: (limit?: number) => ipcRenderer.invoke('cash:list', limit),
    zReport: (shiftId: number) => ipcRenderer.invoke('cash:zReport', shiftId)
  },
  printing: {
    listPrinters: () => ipcRenderer.invoke('printing:listPrinters'),
    testPrint: (input: TestPrintInput) => ipcRenderer.invoke('printing:testPrint', input),
    printSale: (input: PrintSaleInput) => ipcRenderer.invoke('printing:printSale', input),
    printZReport: (shiftId: number) => ipcRenderer.invoke('printing:printZReport', shiftId)
  },
  reports: {
    sales: (input: SalesReportInput) => ipcRenderer.invoke('reports:sales', input),
    stockValue: () => ipcRenderer.invoke('reports:stockValue'),
    lowStock: () => ipcRenderer.invoke('reports:lowStock'),
    receivables: () => ipcRenderer.invoke('reports:receivables'),
    payables: () => ipcRenderer.invoke('reports:payables'),
    saveCsv: (input: SaveCsvInput) => ipcRenderer.invoke('reports:saveCsv', input)
  },
  backup: {
    status: () => ipcRenderer.invoke('backup:status'),
    now: () => ipcRenderer.invoke('backup:now'),
    chooseExtraDir: () => ipcRenderer.invoke('backup:chooseExtraDir'),
    clearExtraDir: () => ipcRenderer.invoke('backup:clearExtraDir'),
    pickFile: () => ipcRenderer.invoke('backup:pickFile'),
    restore: (input: RestoreInput) => ipcRenderer.invoke('backup:restore', input)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).api = api
}
