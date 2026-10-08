import type { Result } from './result'
import type {
  User,
  CreateUserInput,
  LoginInput,
  SetupCompleteInput,
  Category,
  Item,
  CreateItemInput,
  UpdateItemInput,
  ItemFilter,
  ItemListResult,
  BarcodeLookupResult,
  CsvPreviewResult,
  CsvImportResult,
  Party,
  CreatePartyInput,
  UpdatePartyInput,
  PartyFilter,
  PartyListResult,
  Statement,
  StatementInput,
  RecordPaymentInput,
  LedgerEntry
} from './types'

export interface MigrationStatus {
  success: boolean
  error: string | null
}

export interface IpcApi {
  ping: () => Promise<Result<string>>
  app: {
    getVersion: () => Promise<Result<string>>
  }
  db: {
    getMigrationStatus: () => Promise<Result<MigrationStatus>>
  }
  setup: {
    complete: (input: SetupCompleteInput) => Promise<Result<User>>
  }
  modules: {
    getEnabled: () => Promise<Result<string[]>>
    setEnabled: (moduleIds: string[]) => Promise<Result<void>>
  }
  settings: {
    getAll: () => Promise<Result<Record<string, string>>>
    get: (key: string) => Promise<Result<string | null>>
    set: (input: { key: string; value: string }) => Promise<Result<void>>
    setMany: (settings: Record<string, string>) => Promise<Result<void>>
  }
  users: {
    list: () => Promise<Result<User[]>>
    create: (input: CreateUserInput) => Promise<Result<User>>
    deactivate: (id: number) => Promise<Result<void>>
  }
  auth: {
    login: (input: LoginInput) => Promise<Result<User>>
    logout: () => Promise<Result<void>>
    getCurrentUser: () => Promise<Result<User | null>>
    hasUsers: () => Promise<Result<boolean>>
  }
  categories: {
    list: () => Promise<Result<Category[]>>
    create: (name: string) => Promise<Result<Category>>
  }
  items: {
    list: (filter: ItemFilter) => Promise<Result<ItemListResult>>
    get: (id: number) => Promise<Result<Item | null>>
    search: (query: string, limit?: number) => Promise<Result<Item[]>>
    lookupBarcode: (barcode: string) => Promise<Result<BarcodeLookupResult | null>>
    create: (input: CreateItemInput) => Promise<Result<Item>>
    update: (input: UpdateItemInput) => Promise<Result<Item>>
    deactivate: (id: number) => Promise<Result<void>>
    reactivate: (id: number) => Promise<Result<void>>
    previewCsv: (csvContent: string) => Promise<Result<CsvPreviewResult>>
    importCsv: (csvContent: string) => Promise<Result<CsvImportResult>>
  }
  parties: {
    list: (filter: PartyFilter) => Promise<Result<PartyListResult>>
    get: (id: number) => Promise<Result<Party | null>>
    create: (input: CreatePartyInput) => Promise<Result<Party>>
    update: (input: UpdatePartyInput) => Promise<Result<Party>>
    deactivate: (id: number) => Promise<Result<void>>
    reactivate: (id: number) => Promise<Result<void>>
  }
  ledger: {
    statement: (input: StatementInput) => Promise<Result<Statement>>
    recordPayment: (input: RecordPaymentInput) => Promise<Result<LedgerEntry>>
  }
}
