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
  PurchaseReturnInput
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
