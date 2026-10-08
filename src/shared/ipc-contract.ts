import type { Result } from './result'
import type {
  User,
  CreateUserInput,
  LoginInput,
  SetupCompleteInput,
  SetupResult,
  ChangePinInput,
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
  LedgerEntry,
  CreatePurchaseInput,
  PurchaseDetail,
  PurchaseFilter,
  PurchaseListResult,
  PurchaseReturnInput,
  PurchaseReturnResult,
  Sale,
  SaleDraftInput,
  CompleteSaleInput,
  CompleteSaleResult,
  SaleFilter,
  SaleSummary,
  SaleReturnInput,
  SaleReturnResult,
  VoidSaleInput,
  Shift,
  ShiftDetail,
  OpenShiftInput,
  CashEntry,
  CashEntryInput,
  CloseShiftInput,
  ZReport,
  PrinterInfo,
  PrintSaleInput,
  TestPrintInput,
  SalesReportInput,
  SalesReport,
  StockValueReport,
  LowStockRow,
  BalanceReport,
  SaveCsvInput,
  SaveCsvResult,
  BackupStatus,
  BackupNowResult,
  RestoreInput,
  PharmacyItemInfo,
  AllocationPreview,
  ExpiryFilter,
  ExpiryRow,
  WantBookEntry,
  WantBookAddInput,
  WantStatus,
  PharmacyDashboard
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
    complete: (input: SetupCompleteInput) => Promise<Result<SetupResult>>
  }
  pharmacy: {
    getItemInfo: (itemId: number) => Promise<Result<PharmacyItemInfo | null>>
    previewAllocation: (input: { itemId: number; qtyBase: number }) => Promise<Result<AllocationPreview>>
    listExpiry: (filter: ExpiryFilter) => Promise<Result<ExpiryRow[]>>
    wantBookList: (status: WantStatus | 'active') => Promise<Result<WantBookEntry[]>>
    wantBookAdd: (input: WantBookAddInput) => Promise<Result<WantBookEntry>>
    wantBookSetStatus: (input: { id: number; status: WantStatus }) => Promise<Result<WantBookEntry>>
    dashboard: () => Promise<Result<PharmacyDashboard>>
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
    changeOwnPin: (input: ChangePinInput) => Promise<Result<void>>
    resetPin: (input: { userId: number; newPin: string }) => Promise<Result<void>>
  }
  recovery: {
    status: () => Promise<Result<{ hasCode: boolean }>>
    regenerate: (input: { pin: string }) => Promise<Result<{ code: string }>>
  }
  auth: {
    recoverOwnerPin: (input: { code: string; newPin: string }) => Promise<Result<void>>
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
  purchases: {
    list: (filter: PurchaseFilter) => Promise<Result<PurchaseListResult>>
    get: (id: number) => Promise<Result<PurchaseDetail>>
    create: (input: CreatePurchaseInput) => Promise<Result<PurchaseDetail>>
    return: (input: PurchaseReturnInput) => Promise<Result<PurchaseReturnResult>>
  }
  sales: {
    complete: (input: CompleteSaleInput) => Promise<Result<CompleteSaleResult>>
    hold: (input: SaleDraftInput) => Promise<Result<Sale>>
    discardHeld: (id: number) => Promise<Result<void>>
    list: (filter: SaleFilter) => Promise<Result<SaleSummary[]>>
    get: (id: number) => Promise<Result<Sale>>
    getByInvoice: (invoiceNo: string) => Promise<Result<Sale>>
    return: (input: SaleReturnInput) => Promise<Result<SaleReturnResult>>
    void: (input: VoidSaleInput) => Promise<Result<void>>
  }
  cash: {
    current: () => Promise<Result<Shift | null>>
    open: (input: OpenShiftInput) => Promise<Result<Shift>>
    addEntry: (input: CashEntryInput) => Promise<Result<CashEntry>>
    close: (input: CloseShiftInput) => Promise<Result<ShiftDetail>>
    detail: (shiftId: number) => Promise<Result<ShiftDetail>>
    list: (limit?: number) => Promise<Result<Shift[]>>
    zReport: (shiftId: number) => Promise<Result<ZReport>>
  }
  printing: {
    listPrinters: () => Promise<Result<PrinterInfo[]>>
    testPrint: (input: TestPrintInput) => Promise<Result<void>>
    printSale: (input: PrintSaleInput) => Promise<Result<void>>
    printZReport: (shiftId: number) => Promise<Result<void>>
  }
  reports: {
    sales: (input: SalesReportInput) => Promise<Result<SalesReport>>
    stockValue: () => Promise<Result<StockValueReport>>
    lowStock: () => Promise<Result<LowStockRow[]>>
    receivables: () => Promise<Result<BalanceReport>>
    payables: () => Promise<Result<BalanceReport>>
    saveCsv: (input: SaveCsvInput) => Promise<Result<SaveCsvResult>>
  }
  backup: {
    status: () => Promise<Result<BackupStatus>>
    now: () => Promise<Result<BackupNowResult>>
    chooseExtraDir: () => Promise<Result<string | null>>
    clearExtraDir: () => Promise<Result<void>>
    /** Opens a file dialog and validates the chosen file; null when cancelled. */
    pickFile: () => Promise<Result<{ fileName: string } | null>>
    /** Restores a listed backup (name) or the file picked with pickFile; the app then restarts. */
    restore: (input: RestoreInput) => Promise<Result<void>>
  }
}
