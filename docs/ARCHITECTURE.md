# Architecture — Retail POS (Core + Modules)

This is the source of truth for how the app is built. **Do not change decisions in this file without approval** (write the question in `docs/REVIEW_LOG.md` instead).

## 1. What we are building

An **offline-first Windows desktop POS** for small shops in Pakistan.
- One shared **core** (items, billing, purchases, customers/suppliers + khata, cash, users, reports, backup, printing).
- Industry **modules** on top. First module: **pharmacy** (batch/expiry, FEFO, want-book). Later: hardware, garments, restaurant.
- A shop runs on one Windows PC, no internet required. Data lives in one SQLite file on that PC.

### Target machine (design for the weakest)
- Windows 10/11 64-bit, refurbished i3, **4 GB RAM**, screen **1366×768**.
- USB barcode scanner (acts as a keyboard), 58 mm or 80 mm thermal printer with a Windows driver.
- Frequent power cuts → the app must never corrupt data.
- Staff have basic English. Shop owners may prefer Urdu labels.

Development happens on **Linux Mint**; the shipped product is a **Windows installer**.

## 2. Tech stack (fixed)

| Concern | Choice | Why |
|---|---|---|
| App shell | **Electron** (latest stable) | Runs on Linux (dev) and Windows (clients); web tech is easiest to build and maintain |
| Build tool | **electron-vite** | Standard main/preload/renderer setup, fast dev reload |
| Language | **TypeScript** (strict mode) everywhere | Catches mistakes early |
| UI | **React 18 + Mantine v7** (`@mantine/core`, `@mantine/hooks`, `@mantine/form`, `@mantine/notifications`, `@mantine/dates`) | Ready-made accessible components, built-in hotkeys; little custom CSS |
| Icons | `@tabler/icons-react` | Matches Mantine |
| Routing | `react-router-dom` (HashRouter) | Works with `file://` in Electron |
| Database | **SQLite via `better-sqlite3`** in the main process | Fast, synchronous, single file, reliable |
| Validation | **zod** | Validate every IPC input in main |
| i18n | **i18next + react-i18next** | English default, Urdu label pack |
| Tests | **Vitest** | Unit tests for core services |
| Packaging | **electron-builder** → NSIS installer (Windows x64) | Built on a Windows runner via GitHub Actions; AppImage for local Linux testing |

Do **not** add other libraries (ORMs, state managers, CSS frameworks, UI kits) without approval. React state + small custom hooks are enough.

## 3. Process model and security

```
Renderer (React UI)  --window.api.*-->  Preload (contextBridge)  --ipcRenderer.invoke-->  Main (services + SQLite)
```

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- The renderer **never** touches the database or Node APIs. It only calls `window.api.<domain>.<action>(input)`.
- Every IPC handler: validate input with zod → call a service → return `{ ok: true, data } | { ok: false, error: { code, message } }`. Never throw across IPC.
- All business rules (prices, stock, ledger, totals) live in **main-process services**. The renderer only displays and collects input. Totals shown in the UI are previews; the service recalculates and is authoritative.

## 4. Folder structure

```
retail-pos/
├─ GEMINI.md / CLAUDE.md / README.md
├─ docs/                     ARCHITECTURE.md, TASKS.md, REVIEW_LOG.md
├─ resources/                app icon, sample CSVs
├─ src/
│  ├─ shared/                code used by main AND renderer (no Node/DOM imports)
│  │  ├─ money.ts            paisa helpers + formatting
│  │  ├─ result.ts           Result<T> type
│  │  ├─ ipc-contract.ts     typed API shape (window.api)
│  │  └─ types/              domain types (Item, Sale, Party, ...)
│  ├─ main/
│  │  ├─ index.ts            app start, window, module loading
│  │  ├─ db/
│  │  │  ├─ connection.ts    open DB, pragmas
│  │  │  ├─ migrate.ts       migration runner
│  │  │  └─ migrations/      core SQL migrations: 001_core.sql, 002_...
│  │  ├─ core/               one folder per domain, each with service.ts + ipc.ts + service.test.ts
│  │  │  ├─ settings/  users/  items/  parties/  ledger/
│  │  │  ├─ purchases/  sales/  stock/  cash/  reports/
│  │  │  ├─ printing/  backup/  audit/
│  │  ├─ modules/
│  │  │  ├─ registry.ts      loads enabled modules
│  │  │  └─ pharmacy/        index.ts, migrations/, services, ipc
│  │  └─ ipc/register.ts     registers core + module handlers
│  ├─ preload/index.ts       exposes window.api
│  └─ renderer/src/
│     ├─ app/                App.tsx, routes, layout, global hotkeys, theme
│     ├─ components/         shared UI (MoneyInput, ItemSearch, ConfirmDialog, PageHeader...)
│     ├─ screens/            core screens (Sale, Items, Parties, Purchases, Cash, Reports, Settings, Setup)
│     ├─ modules/pharmacy/   pharmacy screens + UI extensions
│     ├─ i18n/               en.json, ur.json
│     └─ lib/api.ts          thin wrapper around window.api with error toasts
└─ .github/workflows/build-windows.yml
```

Rules: keep files under ~300 lines; one service per domain; no circular imports between core domains (sales may call stock/ledger services; not the other way).

## 5. Data rules (very important)

- **Money** is stored and computed as **integer paisa** (PKR × 100). Never use floats for money. Use helpers in `src/shared/money.ts` (`toPaisa`, `fromPaisa`, `formatPKR`). Round only at the line level, half-up.
- **Quantity** is stored as an **integer in the item's base unit** (e.g. tablets, pieces, grams). Packs are conversions (`item_units.factor`), e.g. Box = 100, Strip = 10.
- **Stock is never stored as a number to overwrite.** Stock = SUM of `stock_movements.qty`. Every sale/purchase/adjustment/return inserts movements. (A cached `items.stock_cache` may exist, updated in the same transaction.)
- **Khata (ledger)** is also append-only: `party_ledger` rows with debit/credit. Balance = SUM(debit − credit).
- **Nothing is hard-deleted** for business records. Use `active = 0` or `status = 'void'` and write an `audit_log` row.
- Every multi-table write runs inside **one `db.transaction()`**.
- Dates stored as ISO-8601 text in local time (`YYYY-MM-DD HH:mm:ss`); expiry dates as `YYYY-MM-DD` (use last day of month when only month/year is printed).
- IDs: `INTEGER PRIMARY KEY`. Invoice numbers: separate sequential counter in `settings`.

### SQLite settings (on open)
`journal_mode = WAL`, `synchronous = FULL`, `foreign_keys = ON`, `busy_timeout = 5000`. DB file lives in `app.getPath('userData')/data/shop.db`.

### Migrations
- Plain `.sql` files, numbered, never edited after being merged. Table `schema_migrations(id TEXT PRIMARY KEY, applied_at)`.
- Core migrations run first, then each enabled module's migrations (id prefixed, e.g. `pharmacy/001_init`).
- Runner applies each file in a transaction; on failure, app shows an error screen and does not start.

## 6. Core database (first migration, `001_core.sql`)

| Table | Key columns |
|---|---|
| `settings` | `key TEXT PK, value TEXT` (shop name/address/phone, receipt footer, printer name, paper width, enabled_modules JSON, language, next_invoice_no) |
| `users` | id, name, username UNIQUE, pin_hash, role (`owner`/`manager`/`cashier`), active, created_at |
| `categories` | id, name UNIQUE, active |
| `items` | id, name, search_text (name + aliases, lowercase, for Roman-Urdu search), barcode UNIQUE NULL, category_id, base_unit (e.g. 'tablet','pc'), sale_price (paisa per base unit), cost_price, reorder_level, track_stock, track_lots, stock_cache, active, created_at, updated_at |
| `item_units` | id, item_id, name ('Box','Strip'), factor (base units per pack), barcode NULL, sale_price NULL (override per pack) |
| `stock_lots` | id, item_id, lot_no, expiry_date NULL, cost_price, sale_price NULL, created_at — generic batches; used when `items.track_lots = 1` |
| `stock_movements` | id, item_id, lot_id NULL, qty (signed, base units), type (`purchase`,`sale`,`sale_return`,`purchase_return`,`adjust`,`opening`), ref_type, ref_id, user_id, created_at |
| `parties` | id, type (`customer`/`supplier`), name, phone, address, credit_limit, active, created_at |
| `party_ledger` | id, party_id, type (`opening`,`sale`,`payment_in`,`purchase`,`payment_out`,`return`,`adjust`), ref_type, ref_id, debit, credit, note, user_id, created_at |
| `sales` | id, invoice_no UNIQUE, party_id NULL, user_id, shift_id, status (`held`,`completed`,`void`), subtotal, discount, total, paid_cash, paid_credit, note, created_at |
| `sale_lines` | id, sale_id, item_id, lot_id NULL, unit_name, unit_factor, qty (in that unit), qty_base, unit_price, discount, line_total |
| `purchases` / `purchase_lines` | same idea: supplier_id, bill_no, totals; lines with lot_no, expiry, qty, cost |
| `cash_shifts` | id, user_id, opened_at, opening_cash, closed_at, expected_cash, counted_cash, note |
| `cash_entries` | id, shift_id, type (`in`,`out`,`expense`), amount, note, user_id, created_at |
| `audit_log` | id, user_id, action, entity, entity_id, details (JSON), created_at |

Add indexes for: `items(search_text)`, `items(barcode)`, `item_units(barcode)`, `stock_movements(item_id)`, `stock_lots(item_id, expiry_date)`, `party_ledger(party_id)`, `sales(created_at)`.

## 7. Module system

A module is a folder in `src/main/modules/<id>/` plus `src/renderer/src/modules/<id>/`. Enabled modules are listed in `settings.enabled_modules` (chosen in the first-run wizard).

```ts
// src/main/modules/types.ts
export interface MainModule {
  id: string                       // 'pharmacy'
  migrationsDir: string            // absolute path to its .sql files
  registerIpc(ctx: ModuleContext): void
  stockAllocator?: StockAllocator  // overrides how sales pick lots
  onSaleCompleted?(ctx: ModuleContext, saleId: number): void   // runs inside the sale transaction
}

export interface StockAllocator {
  // Decide which lots a sale line consumes. Default core allocator: no lots / oldest lot first.
  allocate(db: Database, itemId: number, qtyBase: number): Array<{ lotId: number | null; qtyBase: number }>
}

// src/renderer/src/modules/types.ts
export interface UiModule {
  id: string
  routes: Array<{ path: string; element: React.ReactNode }>
  menu: Array<{ label: string; path: string; icon: React.ReactNode; roles?: Role[] }>
  itemFormFields?: React.ComponentType<{ itemId?: number }>        // extra fields on Item form
  saleLineInfo?: React.ComponentType<{ line: SaleLineDraft }>      // extra info under a sale line (e.g. batch/expiry)
  dashboardWidgets?: React.ComponentType[]
}
```

Rules:
- Core must work with **zero modules** enabled (a plain shop POS).
- Core never imports from `modules/`. Modules may import core services.
- Module tables are prefixed with the module id: `pharmacy_item_info`, `pharmacy_want_book`.

### Pharmacy module (first module)
- `pharmacy_item_info`: item_id PK, generic_name, manufacturer, strength, form, schedule (`otc`,`rx`,`controlled`), rack.
- Forces `track_lots = 1` on items; purchases require lot number + expiry.
- **FEFO allocator**: sell from the earliest non-expired lot first; block selling expired lots (owner can override with audit log).
- **Expiry console**: lots expiring in 30/60/90 days, grouped by supplier; printable/WhatsApp-able return list.
- **Want-book**: `pharmacy_want_book(id, item_id NULL, free_text, supplier_id NULL, qty, source 'auto'|'manual', status 'open'|'ordered'|'done', created_at)`. Auto-add when stock reaches reorder level or a searched item is out of stock. Export grouped by supplier as text for WhatsApp.
- Later: drug master catalog import (CSV), controlled-drug register.

## 8. UX rules (user-friendliness is a requirement, not a polish step)

1. **Keyboard first.** The Sale screen is fully usable without a mouse. Global keys: `F1` search item, `F2` change unit, `F3` customer, `F4` discount, `F5` hold bill, `F6` recall held, `F8` payment, `F9` print last, `Esc` cancel/close, `Enter` confirm. Show the keys on screen.
2. **Sale screen is home.** After login, the app opens on Sale. Max 2 clicks/keys to reach any common action.
3. **Fast search.** Item search filters as you type (debounced ≤ 150 ms) by name, alias, barcode. Barcode scan adds the item directly.
4. **Readable.** Base font 16 px, sale totals ≥ 28 px, high contrast, works at 1366×768 without scrolling the sale screen. Light theme default.
5. **Plain language.** Errors say what happened and what to do ("Printer not found. Check it is on, then press F9 to print again."). Never show stack traces to users.
6. **Safe.** Confirm destructive actions; voiding requires owner/manager PIN; held bills survive app restart.
7. **Bilingual labels.** All UI strings come from i18n files (`en.json`, `ur.json`). Urdu uses RTL where it is a full screen; numbers and prices stay LTR.
8. **First-run wizard.** Shop name/address/phone → business type (enables module) → owner name + 4–6 digit PIN → printer + paper width → test print → done. Under 3 minutes.
9. **Roles.** Cashier: sell, hold, take payments. Manager: + purchases, items, void. Owner: everything incl. settings, reports, users.
10. **Never lose work.** Auto daily backup + backup on app close; restore from Settings.

## 9. Printing

- Receipts are HTML templates (58 mm / 80 mm) rendered in a hidden BrowserWindow and printed with `webContents.print({ silent: true, deviceName })` to the Windows printer chosen in Settings.
- Receipt content: shop header, invoice no, date/time, cashier, lines (name, qty×unit, price, total), discount, total, paid, change/balance, footer text.
- Printing failure must never block or undo the sale. Show a toast and allow reprint (`F9`).
- Later (not now): raw ESC/POS for cash-drawer kick.

## 10. Backup

- Use better-sqlite3's `db.backup()` to `userData/backups/shop-YYYYMMDD-HHmm.db`. Keep the last 30. Run on first launch each day and on app close.
- Settings screen: "Backup now", "Choose extra backup folder" (e.g. USB), "Restore from file" (owner only; app restarts).

## 11. Testing & quality gates

- `npm run typecheck`, `npm run lint`, `npm test` must pass before a task is marked done.
- Every core service has Vitest tests using an **in-memory SQLite DB** with migrations applied. Must-test: money rounding, unit conversion, stock after sale/purchase/return, ledger balance, FEFO allocation, invoice numbering.

## 12. Build & release

- Dev on Linux: `npm run dev`. Local Linux package: `npm run build:linux` (AppImage) for testing.
- Windows installer: GitHub Actions workflow on `windows-latest` runs `npm ci && npm run build:win` and uploads the NSIS `.exe` as an artifact. (better-sqlite3 is a native module, so it is built on Windows, not cross-compiled.)
- App name: **Retail POS** (placeholder until branding is chosen). appId `pk.retailpos.app`.
