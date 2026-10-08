# Review Log

Newest entry at the top. Gemini adds a **Build** entry after each milestone; Claude adds a **Review** entry with fixes.

## Template

```
### [Build] Mx — <title> — YYYY-MM-DD
- Summary: what was built (2–4 lines)
- Files: main files added/changed
- Checks: typecheck ✅ lint ✅ tests ✅ (N tests)
- Manual test steps:
  1. ...
- Open questions / deviations:
  - ...

### [Review] Mx — YYYY-MM-DD
- Verdict: approved | fixes needed
- Fixes (do these before the next milestone):
  1. ...
```

---

### [Build] M0 — Project scaffold — 2026-10-08
- Summary: Project scaffolded with electron-vite, React 18, TypeScript strict mode, and Mantine v7. Exact folder structure matching ARCHITECTURE.md §4 created with placeholders. Left sidebar menu with placeholder screens, i18n setup, and HashRouter navigation active.
- Files: package.json, electron.vite.config.ts, tsconfig*.json, .eslintrc.json, .prettierrc, vitest.config.ts, src/main/*, src/preload/*, src/renderer/*, src/shared/*, resources/*, .github/workflows/build-windows.yml
- Checks: typecheck ✅ lint ✅ tests ✅ (13 tests)
- Manual test steps:
  1. Run `npm run dev` from the project root.
  2. Verify Electron window opens maximized with minimum dimensions 1280×720.
  3. Verify left sidebar shows navigation items (Sale, Items, Parties, Purchases, Cash, Reports, Settings).
  4. Click through each sidebar link to verify routing and screen headers load cleanly.
- Open questions / deviations:
  - None.

### [Review] M0 — 2026-10-08
- Verdict: **fixes needed** (small). Scaffold, structure, security settings and scripts are good; app starts, build works.
- Fixes (do these before M1):
  1. **Upgrade outdated versions.** Installed Electron 33 is end-of-life. Upgrade to the current stable releases: `electron@latest`, `electron-builder@latest`, `electron-vite@latest` (+ the `vite` and `@vitejs/plugin-react` versions it requires), `better-sqlite3@latest`, `@types/better-sqlite3@latest`, `vitest@latest`, `@types/node@22`. Keep React 18 and Mantine v7 as they are. Run `npm install`, then confirm `npm run dev`, `npm run build`, typecheck, lint and tests all still work. If an upgrade breaks something you cannot fix in a few tries, stop and report the exact error.
  2. **Remove the 13 placeholder tests** (`expect(true).toBe(true)`). Fake tests hide missing coverage. Delete those `service.test.ts` files and set `test: { passWithNoTests: true }` in `vitest.config.ts`. Real tests start in M1.
  3. Add `*.tsbuildinfo` to `.gitignore` and delete the two `tsconfig.*.tsbuildinfo` files.
  4. Sidebar shows a hardcoded `v0.1.0`. Get it from `window.api.app.getVersion()` instead (the IPC already exists).
  5. In `.github/workflows/build-windows.yml`, add `workflow_dispatch:` to the `on:` triggers so the owner can start a Windows build manually.
- New entries in the log go at the **end of the file** from now on (keeps order simple).

### [Build] Fixes for M0 — 2026-10-08
- Summary: Applied all 5 review fixes from Claude's review of M0. Upgraded dependencies to latest stable, removed placeholder tests, cleaned tsbuildinfo, made sidebar version dynamic via IPC, and added workflow_dispatch.
- Fix details:
  - Fix 1: Upgraded `electron` (44.7.0), `electron-builder` (26.15.3), `electron-vite` (5.0.0), `better-sqlite3` (13.0.3), `@types/better-sqlite3` (9.6.0), `vitest` (5.0.3), `@types/node` (22.13.0), `vite` (7.3.7), `@vitejs/plugin-react` (5.2.0), `typescript` (5.7.2), and `@typescript-eslint/*` (8.26.0). Confirmed dev, build, typecheck, lint, and tests all pass.
  - Fix 2: Removed 13 placeholder `service.test.ts` files and configured `passWithNoTests: true` in `vitest.config.ts`.
  - Fix 3: Added `*.tsbuildinfo` to `.gitignore` and deleted `tsconfig.*.tsbuildinfo` files.
  - Fix 4: Updated sidebar in `src/renderer/src/app/layout.tsx` to retrieve app version dynamically via `window.api.app.getVersion()`.
  - Fix 5: Added `workflow_dispatch:` trigger to `.github/workflows/build-windows.yml`.
- Checks: typecheck ✅ lint ✅ tests ✅

### [Review] M0 fixes — 2026-10-08
- Verdict: **approved**. All 5 fixes verified (Electron 44, better-sqlite3 13, placeholder tests gone, dynamic version, manual workflow trigger). Typecheck, lint, build and dev launch OK.
- Note: tsc recreates `*.tsbuildinfo` on typecheck; they are git-ignored now, that's fine.
- Next: M1.

### [Build] M1 — Database + shared basics — 2026-10-08
- Summary: Implemented shared money helpers with integer paisa & half-up rounding, Result type with zod IPC validation helper, SQLite connection with strict pragmas (WAL, synchronous FULL, foreign_keys ON, busy_timeout 5000), 001_core.sql schema with all tables & indexes, migration runner, in-memory test DB helper, and migration error screen.
- Files: src/shared/money.ts, src/shared/money.test.ts, src/shared/result.ts, src/shared/result.test.ts, src/shared/ipc-contract.ts, src/main/ipc/handle.ts, src/main/ipc/register.ts, src/main/db/connection.ts, src/main/db/migrate.ts, src/main/db/migrate.test.ts, src/main/db/test-helper.ts, src/main/db/migrations/001_core.sql, src/main/index.ts, src/renderer/src/screens/MigrationErrorScreen.tsx, src/renderer/src/app/App.tsx, src/renderer/src/app/routes.tsx, src/renderer/src/i18n/en.json, src/renderer/src/i18n/ur.json
- Checks: typecheck ✅ lint ✅ tests ✅ (25 tests)
- Manual test steps:
  1. Run `npm run dev` from project root.
  2. Verify `shop.db`, `shop.db-wal`, and `shop.db-shm` are created in `~/.config/retail-pos/data/` (or userData path).
  3. Verify all 16 business tables and `schema_migrations` table exist in `shop.db` with `001_core` recorded.
  4. Verify the application loads normally without showing any database error screen.
  5. To verify migration error screen, pass an invalid DB path or cause a migration error and observe the user-friendly error screen displays with retry option.
- Open questions / deviations:
  - None.

### [Review] M1 — 2026-10-08
- Verdict: **fixes needed**. Good work overall: pragmas, transactions per migration, schema with CHECKs/FKs, Result + zod IPC helper, 25 real tests passing.
- Fixes:
  1. **Dates must be local time, not UTC.** `migrate.ts` uses `toISOString()` (UTC). Pakistan is UTC+5, so a sale at 8 PM would be stored as the next day and break daily reports. Create `src/shared/dates.ts` with `nowLocal()` → `'YYYY-MM-DD HH:mm:ss'` and `todayLocal()` → `'YYYY-MM-DD'` built from local `Date` getters (no `toISOString`). Add tests (use `vi.setSystemTime`). Use `nowLocal()` in `migrate.ts` and everywhere a timestamp is written from now on.
  2. **Held bills must not use invoice numbers.** In `001_core.sql` change `sales.invoice_no` to `TEXT UNIQUE` (nullable). The invoice number is assigned only when a sale is completed (M7). Edit `001_core.sql` directly (nothing released yet) and delete your local dev `shop.db*` files.
  3. **Make `toPaisa` safe for typed input.** Change it to `toPaisa(input: string | number): number`. For strings: trim, remove commas, accept optional leading `-`, digits, optional `.` with at most 2 decimals; convert by splitting on `.` (no float multiply). For numbers: `Math.round(Number(input.toFixed(2)) * 100)`. Throw an `Error('Invalid amount')` for empty/NaN/more than 2 decimals. Tests: `"1,234.50"`→123450, `"0.1"`→10, `1.005`→101, `"12.345"` throws, `"abc"` throws, `"-5"`→-500.
  4. **Remove `loadMigrationsFromDir`** from `migrate.ts` (and its tests). SQL files are not shipped in the installer, so reading them from disk at runtime would fail on Windows. Module migrations will be imported with `?raw` (ARCHITECTURE §5 and §7 updated).
  5. Add a test: a migration with invalid SQL throws, is **not** recorded in `schema_migrations`, and leaves no partial tables (proves rollback).

### [Build] Fixes for M1 — 2026-10-08
- Summary: Applied all 5 review fixes from Claude's review of M1. Implemented local date helpers (nowLocal/todayLocal), made sales.invoice_no nullable, made toPaisa safe for string and number inputs with strict validation, removed disk-based loadMigrationsFromDir, and added a test proving migration transaction rollback.
- Fix details:
  - Fix 1: Created `src/shared/dates.ts` (`nowLocal`, `todayLocal`, `formatLocalDate`, `formatLocalDateTime`) using local `Date` getters (no UTC/toISOString) and added tests in `src/shared/dates.test.ts` with `vi.setSystemTime`. Replaced UTC timestamp generation in `migrate.ts` with `nowLocal()`.
  - Fix 2: Changed `sales.invoice_no` to `TEXT UNIQUE` (nullable) in `001_core.sql` so held bills can be stored without invoice numbers. Deleted local dev `shop.db*` files. Added test verifying null invoice_no for held sales.
  - Fix 3: Updated `toPaisa(input: string | number)` in `src/shared/money.ts` to strictly validate strings (trim, remove commas, optional `-`, <=2 decimals, split on `.`) and round numbers half-up to 2 decimals. Throws `Error('Invalid amount')` on empty/NaN/invalid/>2 decimals. Added tests in `src/shared/money.test.ts`.
  - Fix 4: Removed `loadMigrationsFromDir` and filesystem reading from `src/main/db/migrate.ts` in favor of bundling raw SQL.
  - Fix 5: Added test in `src/main/db/migrate.test.ts` verifying that a migration with invalid SQL throws, is not recorded in `schema_migrations`, and rolls back previously executed statements without leaving partial tables.
- Checks: typecheck ✅ lint ✅ tests ✅ (35 tests)

### [Review] M1 fixes — 2026-10-08
- Verdict: **approved**. All 5 fixes verified; typecheck, lint, 35 tests pass.
- Next: M2.

### [Build] M2 — Module system skeleton — 2026-10-08
- Summary: Defined MainModule and UiModule interfaces per ARCHITECTURE §7. Implemented module registry that reads settings.enabled_modules and runs module migrations after core migrations. Created pharmacy module skeleton with pharmacy/001_init migration (pharmacy_item_info) and Expiry menu item + screen. Sidebar and routes dynamically mount active UI modules, and app functions with zero modules enabled.
- Files: src/main/modules/types.ts, src/main/modules/registry.ts, src/main/modules/registry.test.ts, src/main/modules/pharmacy/index.ts, src/main/modules/pharmacy/migrations/001_pharmacy.sql, src/renderer/src/modules/types.ts, src/renderer/src/modules/registry.ts, src/renderer/src/modules/registry.test.ts, src/renderer/src/modules/ModuleContext.tsx, src/renderer/src/modules/index.ts, src/renderer/src/modules/pharmacy/index.tsx, src/renderer/src/modules/pharmacy/ExpiryScreen.tsx, src/renderer/src/app/App.tsx, src/renderer/src/app/layout.tsx, src/renderer/src/app/routes.tsx, src/shared/ipc-contract.ts, src/preload/index.ts, src/main/ipc/register.ts, src/main/index.ts, src/renderer/src/i18n/en.json, src/renderer/src/i18n/ur.json
- Checks: typecheck ✅ lint ✅ tests ✅ (48 tests)
- Manual test steps:
  1. Run `npm run dev` from project root. Notice that without pharmacy enabled, the sidebar displays only core items (Sale, Items, Parties, Purchases, Cash, Reports, Settings).
  2. Open DevTools (Ctrl+Shift+I) and run `await window.api.modules.setEnabled(['pharmacy']); location.reload();`.
  3. Notice that "Expiry" (or Urdu "ایکسپائری (Expiry)") now appears in the sidebar above Settings.
  4. Click "Expiry" to navigate to `/pharmacy/expiry` and verify the Expiry Console placeholder screen renders cleanly.
  5. In DevTools, run `await window.api.modules.setEnabled([]); location.reload();`. Verify "Expiry" disappears from the menu and the app continues working as a plain POS with zero modules enabled.
- Open questions / deviations:
  - None.


### [Review] M2 — 2026-10-08
- Verdict: **fixes needed** (small). Module contract, ?raw migrations, renderer context and dynamic menu are good.
- Fixes:
  1. **Keep the active modules in the registry.** `initModules()` returns the list but nobody stores it, so `getStockAllocator()` can never be used later. Store the result in a module-level variable inside `registry.ts` and add `getActiveModules(): MainModule[]`. `initModules` must replace (not append to) this list each time, so disabling a module removes it. Update tests.
  2. **Only accept known module IDs.** In `modules:setEnabled`, reject IDs not in `AVAILABLE_MODULES` (return `err` with code `UNKNOWN_MODULE`) and remove duplicates.
  3. **Run migrations before saving the setting.** In `setEnabled`: first apply the migrations of the newly enabled modules; only if that succeeds, save `enabled_modules`. Otherwise a failed migration would leave a module enabled and the app would fail on every start. Add a test where a module migration fails and `enabled_modules` stays unchanged.
- Note for M3: `modules:setEnabled` must become **owner-only** when IPC permission checks are added.

### [Build] Fixes for M2 — 2026-10-08
- Summary: Applied all 3 review fixes from Claude's review of M2. Stored active modules in registry with getActiveModules() replacing on each init, validated and deduplicated module IDs in setEnabled with UNKNOWN_MODULE rejection, ran migrations before persisting enabled_modules, and added comprehensive unit tests.
- Fix details:
  - Fix 1: Added `activeModules` module-level state and `getActiveModules(): MainModule[]` in `src/main/modules/registry.ts`. `initModules()` replaces `activeModules` each run so disabling removes modules. Updated `getStockAllocator()` to default to `activeModules`.
  - Fix 2: In `setEnabledModuleIds` (and `modules:setEnabled` IPC), deduplicated module IDs with `new Set` and rejected any unknown IDs not in `AVAILABLE_MODULES`, returning `err({ code: 'UNKNOWN_MODULE', message: ... })`.
  - Fix 3: In `setEnabledModuleIds`, applied migrations for enabled modules first; only if migrations succeed is `enabled_modules` persisted to `settings`. Added unit test proving that a failing module migration returns `MIGRATION_FAILED` and leaves `enabled_modules` unchanged in database.
- Checks: typecheck ✅ lint ✅ tests ✅ (52 tests)


### [Review] M2 fixes — 2026-10-08
- Verdict: **approved**. All 3 fixes verified; typecheck, lint, 52 tests pass.
- Next: M3 (remember: `modules:setEnabled` and settings writes are owner-only).

### [Build] M3 — Settings, users, first-run wizard, login — 2026-10-08
- Summary: Implemented settings service with typed keys and transactional writes, users service with crypto.scrypt PIN hashing/verification and last-owner protection, auth session management with role-based IPC permission checks (owner-only for modules:setEnabled and settings/user writes), first-run setup wizard, login screen with user picker & keypad/keyboard support, role-based sidebar menu hiding for cashier, and full English & Urdu i18n support with runtime language switching.
- Files: src/shared/types/index.ts, src/shared/ipc-contract.ts, src/preload/index.ts, src/main/core/settings/service.ts, src/main/core/settings/service.test.ts, src/main/core/users/service.ts, src/main/core/users/service.test.ts, src/main/core/auth/service.ts, src/main/core/auth/service.test.ts, src/main/ipc/register.ts, src/renderer/src/context/AuthContext.tsx, src/renderer/src/screens/setup/SetupSteps.tsx, src/renderer/src/screens/SetupScreen.tsx, src/renderer/src/screens/LoginScreen.tsx, src/renderer/src/screens/settings/UsersTab.tsx, src/renderer/src/screens/SettingsScreen.tsx, src/renderer/src/app/layout.tsx, src/renderer/src/app/routes.tsx, src/renderer/src/app/App.tsx, src/renderer/src/i18n/index.ts, src/renderer/src/i18n/en.json, src/renderer/src/i18n/ur.json, docs/TASKS.md, docs/REVIEW_LOG.md
- Checks: typecheck ✅ lint ✅ tests ✅ (67 tests)
- Manual test steps:
  1. Delete local dev DB if needed (`rm -rf ~/.config/retail-pos/data/shop.db*`) and run `npm run dev`.
  2. Verify app automatically detects 0 users and opens the First-Run Setup Wizard at `/setup`.
  3. Fill in shop details, choose business type (e.g. Pharmacy), create Owner with PIN (e.g. 1234), test printer button (shows simulated notification), select language, and click "Complete Setup & Launch POS".
  4. Verify app logs in as Owner and redirects to the Sale screen (`/`). Verify sidebar shows all core items, Expiry (if pharmacy was chosen), Settings, and user badge in footer.
  5. Open Settings (`/settings`), go to Users tab, click "Add User", and create a Cashier (username `cashier1`, PIN `5555`).
  6. Click Logout in the sidebar footer. Verify the Login screen appears with both Owner and Cashier listed.
  7. Select Cashier, enter PIN `5555` using keyboard or on-screen keypad, and click Login.
  8. Verify Cashier is redirected to Sale screen, and "Settings" is hidden from the sidebar. Attempting to navigate to `#/settings` redirects back to `/`.
- Open questions / deviations:
  - None.


### [Review] M3 — 2026-10-08
- Verdict: **fixes needed**. Good: scrypt + random salt + timingSafeEqual, pin_hash never leaves main, owner-only checks on settings/users/modules, last-owner protection, zod on inputs.
- Fixes:
  1. **Replace the "no users = everything allowed" bypass with one setup call.** Right now `checkPermission` allows *any* write while no users exist, and the wizard makes 3 separate calls (settings → modules → users). If one fails, setup is half-done, and the first user could be created as a cashier (then no owner exists). Do this instead:
     - Add IPC `setup:complete` with zod input `{ shop: {name, address, phone}, language, paperWidth, printerName, moduleIds: string[], owner: {name, username, pin} }`.
     - In main: if any user exists → return `err('ALREADY_SET_UP')`. Otherwise, in **one `db.transaction()`**: validate module IDs, apply their migrations, save settings + `enabled_modules`, create the user with role **forced to `'owner'`**. Then call `initModules` and log the owner in.
     - Remove the `if (!hasUsers(db)) return ok()` branch from `checkPermission`.
     - Wizard calls only `setup:complete`.
     - Tests: setup succeeds once; second call returns ALREADY_SET_UP; a failing module migration leaves zero users and no settings saved.
  2. **Lock out PIN guessing.** A 4-digit PIN can be guessed by a cashier. In `auth/service.ts` keep an in-memory counter per userId: after **5 wrong PINs**, refuse logins for that user for **60 seconds** (`err('LOCKED', 'Too many wrong PINs. Try again in 1 minute.')`). Reset the counter on a successful login. Show the message on the Login screen. Tests with `vi.useFakeTimers`.
  3. `auth:login` input: `pin: z.string().regex(/^\d{4,6}$/)` and `userId: z.number().int().positive()` (same style as users:create).

### [Build] Fixes for M3 — 2026-10-08
- Summary: Applied all 3 review fixes from Claude's review of M3. Added atomic setup:complete IPC running module migrations, settings persistence, and forced owner creation in a single transaction while removing unauthenticated bypass; implemented in-memory PIN lockout after 5 failed attempts for 60 seconds with error messaging; and strengthened auth:login input validation.
- Fix details:
  - Fix 1: Added `setup:complete` IPC with Zod validation. If users exist, returns `ALREADY_SET_UP`. Inside a single `db.transaction()`: validates module IDs, runs module migrations, saves settings + `enabled_modules`, and creates owner user with role forced to `'owner'`. Removed `if (!hasUsers(db)) return ok()` bypass from `checkPermission`. Updated Setup wizard to call `window.api.setup.complete`. Added tests for single successful run, rejection on second call, and rollback leaving zero users and no settings if migration fails.
  - Fix 2: Added in-memory failed attempt tracking per `userId` in `src/main/core/auth/service.ts`. After 5 failed PIN attempts, locks user out for 60 seconds returning `err({ code: 'LOCKED', message: 'Too many wrong PINs. Try again in 1 minute.' })`. Counter resets on successful login. Displayed lockout error message on `LoginScreen`. Added tests using `vi.useFakeTimers()`.
  - Fix 3: Updated `auth:login` input schema in `src/main/ipc/register.ts` to require `userId: z.number().int().positive()` and `pin: z.string().regex(/^\d{4,6}$/)`.
- Checks: typecheck ✅ lint ✅ tests ✅ (72 tests)


### [Review] M3 fixes — 2026-10-08
- Verdict: **approved**. One-transaction `setup:complete` with forced owner, bypass removed, PIN lockout (5 tries / 60 s), stricter login validation. Typecheck, lint, 72 tests pass.
- Next: owner clicks through the M3 manual test steps, then M4.

### [Build] M4 — Items — 2026-10-08
- Summary: Implemented complete Items service with categories, units (pack conversions), fast multi-term search (name/alias/barcode), barcode lookup on items and pack units, soft deactivation, opening stock movements, and high-performance CSV import with validation & preview. Built keyboard-friendly searchable Items UI with Add/Edit item form, pack units, CSV import modal with sample format copying, category management, role-based controls, and full English & Urdu i18n.
- Files: src/shared/types/index.ts, src/shared/csv.ts, src/shared/csv.test.ts, src/shared/ipc-contract.ts, src/preload/index.ts, src/main/core/audit/service.ts, src/main/core/audit/service.test.ts, src/main/core/items/categories.ts, src/main/core/items/import.ts, src/main/core/items/service.ts, src/main/core/items/service.test.ts, src/main/core/items/ipc.ts, src/main/core/items/ipc.test.ts, src/main/ipc/register.ts, src/renderer/src/screens/items/CategoryModal.tsx, src/renderer/src/screens/items/ItemFormModal.tsx, src/renderer/src/screens/items/CsvImportModal.tsx, src/renderer/src/screens/ItemsScreen.tsx, src/renderer/src/i18n/en.json, src/renderer/src/i18n/ur.json, docs/TASKS.md, docs/REVIEW_LOG.md
- Checks: typecheck ✅ lint ✅ tests ✅ (89 tests)
- Manual test steps:
  1. Run `npm run dev` and login as Owner or Manager. Navigate to "Items" (`#/items`) via the sidebar.
  2. Press `F1` or click Search to test item filtering. Click "+ Add Item" (or press `Insert`) and enter an item (e.g. "Panadol 500mg", base unit "tablet", sale price 3.50, cost price 2.80, opening stock 200). Add a pack unit "Box" with factor 200. Click Save.
  3. Verify the item displays in the table with its category, prices in PKR, stock count, and pack badge "Box (200)".
  4. Click "Import CSV", click "Copy Sample CSV Format", upload or choose `resources/sample-items.csv`, verify preview validation passes with 5 valid rows and 0 errors, then click "Import 5 Items".
  5. In the table, test searching for "Arinac" or scanning/typing barcode `10002` to confirm instant filtering.
  6. Logout and login as Cashier, open "Items", and verify items can be searched and viewed, but Add/Edit/Import action buttons are not visible.
- Open questions / deviations:
  - None.


### [Review] M4 — 2026-10-08
- Verdict: **fixes needed** (small). Good: prices in paisa end to end, zod on all inputs, role checks on every handler, create and import each run in one transaction, opening stock posts an `opening` movement, audit log wired, 5,000-item benchmark test exists. Typecheck passes and all 89 tests pass.
- Fixes:
  1. **Don't trust CSV rows sent from the screen.** `items:importCsv` takes already-parsed rows from the renderer and inserts them without checking barcodes again. If a barcode was added after the preview (or rows are edited), the `items.barcode UNIQUE` error kills the whole import, and nothing checks pack factor ≥ 2 / base unit.
     - Change `items:importCsv` input to `z.string()` (the raw CSV text, same as preview).
     - In main: run `parseItemsCsv(csv, getAllExistingBarcodes(db))` again and import **only the valid rows**. Return `skippedCount` = number of error rows.
     - Renderer sends the same file text it previewed.
     - Test: preview, then create an item with one of the CSV barcodes, then import → that row is skipped, the rest are imported, no crash.
  2. **Check every barcode the same way (items and packs).** `updateItem` never checks unit barcodes, and `createItem` doesn't catch two packs with the same barcode in one form.
     - Add one helper `findBarcodeConflict(db, barcode, excludeItemId?)` that checks `items.barcode` and `item_units.barcode`.
     - In create and update: collect item barcode + all unit barcodes, reject duplicates inside the input, then call the helper for each. Error `BARCODE_EXISTS` with the barcode in the message.
     - Tests: update with a unit barcode used by another item → BARCODE_EXISTS; create with two packs sharing a barcode → BARCODE_EXISTS.
  3. **Opening stock for batch (lot) items.** Opening stock with `trackLots = true` creates a movement with no lot, which the FEFO allocator (M7) can't use. For now: if `trackLots` and opening qty > 0 → `err('LOT_REQUIRED', 'Add stock for batch items through Purchase')`. In the form, hide the opening stock field when "Track lots" is ticked. Test it.
  4. Small ones:
     - Escape `%` and `_` in search words (`LIKE ? ESCAPE '\'`) in both `searchItems` and `listItems`.
     - zod caps: `pageSize` max 200, search `limit` max 200, `name`/`baseUnit`/unit `name` use `z.string().trim().min(1)`.
     - In `searchItems`, pass `limit` as a number (not `String(limit)`).
- After fixes: run typecheck, lint and tests, then add a `[Build] Fixes for M4` entry.


### [Build] Fixes for M4 — 2026-10-08
- Summary: Applied all 4 review fixes from Claude's review of M4. CSV import now re-validates on the main side, all barcodes (items and packs) are checked by one helper, batch items reject opening stock, and search/zod hardening is done.
- Fix details:
  - Fix 1: `items:importCsv` now takes the raw CSV text (`z.string()`). `importCsv` re-runs `parseItemsCsv(csv, getAllExistingBarcodes(db))`, imports only valid rows and returns `skippedCount` = error rows. Removed `csvRowSchema`; preload and IPC contract updated. `CsvImportModal` keeps the previewed file text and sends it, and shows a notice when rows were skipped (new `items.importSkipped` in en/ur). Test: preview, create an item with one CSV barcode, import -> that row skipped, others imported.
  - Fix 2: New `src/main/core/items/barcodes.ts` with `findBarcodeConflict(db, barcode, excludeItemId?)` (checks `items.barcode` and `item_units.barcode`) and `checkBarcodes` (rejects duplicates inside the input, then checks each against the DB). Used by `createItem` and `updateItem`; error `BARCODE_EXISTS` with the barcode in the message. Tests: update with a unit barcode owned by another item, create with two packs sharing a barcode, update keeping its own barcodes.
  - Fix 3: `createItem` returns `LOT_REQUIRED` ('Add stock for batch items through Purchase') when `trackLots` and opening qty > 0. Test added.
  - Fix 4: `%`, `_` and `\` escaped in `searchItems` and `listItems` (`LIKE ? ESCAPE '\'`); zod `pageSize` and search `limit` max 200; `name`/`baseUnit`/unit `name` use `z.string().trim().min(1)`; `searchItems` passes `limit` as a number. Test for literal `%`/`_` search.
- Checks: typecheck ✅ lint ✅ tests ✅ (95 tests)
- Open questions / deviations:
  - `ItemFormModal` has no "Track lots" checkbox yet, so there was nothing to hide for the opening-stock field; the backend check covers it. When the checkbox is added, hide opening stock when it is ticked.

### [Review] M4 fixes — 2026-10-08
- Verdict: **approved**. Import re-parses in main, shared barcode check, LOT_REQUIRED guard, LIKE escaping, zod caps. Typecheck + 95 tests pass. Note for M6/M12: when a "Track lots" checkbox is added to the item form, hide opening stock when ticked.


### [Build] M5 — Parties + khata — 2026-10-08
- Summary: Customers and suppliers CRUD (soft deactivate, search, paging) with opening balance posted to the ledger in the same transaction as the party insert. New ledger service is the only code that inserts into `party_ledger`: `postEntry`, `getBalance`, `getStatement` (opening balance before the start date + running balance + totals) and `recordPayment`. `postEntry` is a single INSERT with no transaction of its own, so M6/M7 can call it inside their own `db.transaction()`. Parties screen (Customers / Suppliers tabs) with receive/make payment dialog and a printable statement (`window.print()` with a print stylesheet).
- Sign convention (also in the header comment of `ledger/service.ts`): `balance = SUM(debit) - SUM(credit)`, same for both party types. Positive = party owes the shop; negative = shop owes the party (or customer advance). sale = debit, payment_in = credit (customer); purchase = credit, payment_out = debit (supplier). Customer opening balance = debit; supplier opening balance = credit. `postEntry` enforces side and party type for sale/payment_in/purchase/payment_out.
- Files: src/shared/types/parties.ts, src/shared/types/index.ts, src/shared/ipc-contract.ts, src/preload/index.ts, src/main/ipc/register.ts, src/main/core/ledger/{service,ipc,service.test}.ts, src/main/core/parties/{service,ipc,permissions,service.test,permissions.test}.ts, src/renderer/src/screens/PartiesScreen.tsx, src/renderer/src/screens/parties/{PartyFormModal,PaymentModal,StatementModal,BalanceText}.tsx, src/renderer/src/app/print.css, src/renderer/src/main.tsx, src/renderer/src/i18n/en.json, src/renderer/src/i18n/ur.json, docs/TASKS.md, docs/REVIEW_LOG.md
- Checks: typecheck ✅ lint ✅ tests ✅ (119 tests, 24 new). Not run by hand (`npm run dev` needs a display); UI is typechecked and linted only.
- Manual test steps:
  1. `npm run dev`, log in as Owner, open Parties. Press Insert, add customer "Ali" with opening balance 1500 -> list shows Rs 1,500.00 to receive.
  2. Click the cash icon on Ali, receive 500 -> balance Rs 1,000.00. Open the statement icon: opening row, payment row, closing balance 1,000.00. Set From = today: opening balance carries 1,500 or 1,000 depending on entry date; check running balance. Click Print and check only the statement prints.
  3. Suppliers tab: add "Hamid Traders" with opening 7000 (you owe) -> Rs 7,000.00 to pay. Make payment 2000 -> 5,000.00 to pay.
  4. Deactivate a party (confirm dialog), switch the status filter to All, reactivate.
  5. Log in as Cashier: no Suppliers tab, no credit limit / opening balance fields, no deactivate button; receiving a customer payment works.
- Open questions / deviations:
  - Overpayment is allowed (balance flips to the other side, shown as "to pay" for a customer = advance). The payment dialog shows "Balance after" so a typo is visible. Say if you want it blocked.
  - Opening balance can only be entered when creating a party (later changes should be an `adjust` entry; no UI for adjustments yet).
  - Credit limit is stored and editable but not enforced yet (M7 sale screen should check it).
  - Cashiers can create/edit customers and take payments, but only manager/owner can set credit limit, opening balance, deactivate, or touch suppliers (`parties/permissions.ts`).
  - Duplicate names are rejected only among ACTIVE parties of the same type (case-insensitive).
  - `Statement` has `partyId`, not the party object, to avoid a ledger <-> parties import cycle; the screen already has the party.
  - `ledger/ipc.ts` imports `checkPartyAccess` from `parties/ipc.ts` (role check by party type).

### [Review] M5 — 2026-10-08
- Verdict: **approved**. Single ledger entry point (`postEntry`, no own transaction), clear sign convention (debit − credit, + = party owes shop), opening balance in same transaction, statement with carried-in balance. Typecheck + 119 tests pass. Decisions accepted: overpayment allowed (advance); credit limit enforced in M7.


### [Build] M6 — Purchases — 2026-10-08
- Summary: Purchase entry (supplier, bill no, date, lines with base/pack unit, qty, cost, batch no + expiry for lot items), purchase list and detail with partial/multiple returns. New reusable stock service (`postMovement`, `findOrCreateLot`, `getItemStock`, `getLotStock`) that M7 sales will use. Everything for a purchase (purchase, lines, lots, movements, stock_cache, item cost, supplier ledger, audit) runs in ONE `db.transaction()`; any bad line rolls back the whole bill (`TxAbort` in `purchases/tx.ts` turns a thrown abort into an `err` Result). Main recomputes all totals; the renderer only sends itemId, unit name, qty, unit cost, lot, expiry, discount, paid.
- How it posts:
  - Stock: one `purchase` movement per line in BASE units (qty × pack factor), `items.stock_cache` updated in the same call. Lot items: lot found by (item, lot_no) or created (cost per base unit); same lot no with a different expiry -> `LOT_EXPIRY_MISMATCH`. Lot stock = SUM(movements) per lot (no qty column on `stock_lots`).
  - Ledger (via `postEntry` only): `purchase` CREDIT for the bill total; if paid now > 0, a `payment_out` DEBIT for the paid amount (cash purchase nets to 0). Purchase date is used as the ledger entry date.
  - Money: line total = qty × unit cost (paisa, exact). Cost per base unit = round half-up(unit cost / factor); stored on the lot and written to `items.cost_price` (latest cost wins; ARCHITECTURE is silent, so I did this and note it here).
  - Return: `purchase_returns` + `purchase_return_lines`; per line qty (base units) <= purchased - already returned; negative `purchase_return` movements on the same lot (`postMovement` refuses item or lot going below zero); ledger `return` DEBIT. Refund = qty share rounded half-up; the final return of a line refunds the exact remainder so partial returns never exceed the bill.
- Files: src/main/db/migrations/002_purchases.sql, src/main/db/migrate.ts, src/main/core/stock/service.ts (+test), src/main/core/purchases/{service,returns,queries,tx,ipc,service.test}.ts, src/shared/types/purchases.ts, src/shared/types/index.ts, src/shared/ipc-contract.ts, src/preload/index.ts, src/main/ipc/register.ts, src/renderer/src/screens/PurchasesScreen.tsx, src/renderer/src/screens/purchases/{PurchaseFormModal,PurchaseItemPicker,PurchaseDetailModal}.tsx, src/renderer/src/screens/items/ItemFormModal.tsx, src/renderer/src/i18n/{en,ur}.json, docs/TASKS.md, docs/REVIEW_LOG.md
- Checks: typecheck ✅ lint ✅ tests ✅ (132 tests, 13 new). Not run by hand (`npm run dev` needs a display); UI is typechecked and linted only.
- Manual test steps:
  1. `npm run dev`, log in as Owner. Items: add "Panadol" with a Box pack (factor 100) and tick "Track batches"; the opening stock field disappears. Add a normal item "Pen" with opening stock 5.
  2. Parties > Suppliers: add "Hamid Traders". Purchases: press Insert. Pick Hamid, bill no 101, search "pana" (or scan), Enter. Set unit Box, qty 2, cost 500, batch B1, expiry 2027-12-31. Add Pen, qty 10, cost 20. Check totals, Ctrl+Enter.
  3. Items: Panadol stock 200, Pen 15, cost prices updated. Parties > Suppliers: Hamid shows the bill total to pay. Statement shows the purchase row.
  4. New purchase with "Pay full": supplier balance does not change. With a part payment: only the rest is owed.
  5. Open a purchase, "Return goods", enter 50 for Panadol, confirm: stock 150, supplier balance drops. Try returning more than purchased: refused.
  6. Log in as Cashier: Purchases calls are refused.
- Open questions / deviations:
  - New migration `002_purchases.sql` (not in the original schema): adds `purchases.purchase_date` and the `purchase_returns` / `purchase_return_lines` tables. Needed to track returned qty per line.
  - Items with `track_stock = 0` are rejected on purchases (`ITEM_NOT_STOCKED`).
  - Returns are entered in base units, not pack units.
  - Cash paid/refunded is not written to the cash drawer yet (M9). A refund received from the supplier is not recorded as cash; the return only reduces the supplier balance (it can go positive = supplier owes us).
  - Future purchase dates are rejected; expired expiry dates are allowed.
  - No void/edit of a purchase (use a return). `stock/ipc.ts` is still the empty placeholder (no renderer need yet).

### [Review] M6 — 2026-10-08
- Verdict: **approved**. Stock service is the single writer of movements + stock_cache, no-negative guard on item and lot, `must()/runAtomic` rolls back the whole bill on any bad line, ledger via `postEntry`, migration 002 append-only. Typecheck + 132 tests pass. Accepted: cost_price updated to latest cost; returns in base units. Follow-up for M7: move `purchases/tx.ts` to `src/main/db/tx.ts` and reuse it.

### [Build] M7 — Sale screen — 2026-10-08
- Summary: Sale screen (search/scan, line grid, totals, shortcut bar, F1-F8, keyboard only), sale service, held bills, returns and void. `completeSale` re-prices every line from the DB (renderer sends only item id, unit id, qty, discounts, customer, cash/credit amounts), allocates stock through the allocator (module's if active, else the new default in `stock/allocator.ts`), and writes sale + lines + lot chunks + stock movements + khata + invoice number + audit + `onSaleCompleted` hooks in ONE transaction using `must()/runAtomic` (`purchases/tx.ts` moved to `src/main/db/tx.ts`). Any failure (including a throwing module hook) rolls back everything, including the invoice counter.
- How it posts:
  - Money (`src/shared/sale-calc.ts`, shared with the renderer preview): line_total = unit_price x qty - line discount (flat or percent in basis points, half-up). Bill discount (flat or %) is shared across lines by largest remainder into `sale_lines.net_total`, so SUM(net_total) = total exactly. `sales.subtotal` = sum of gross, `sales.discount` = line + bill discounts, `sales.total` = subtotal - discount. Pack price = pack override, else base price x factor.
  - Payment: `paid_cash` = total - credit (cash that stays in the drawer); extra cash handed over is only returned as `changeDue`. `paid_credit` goes to the customer ledger as a `sale` DEBIT through `postEntry`. Short payment, credit without a customer, supplier as customer, inactive customer: refused.
  - Stock: one `sale` movement per allocation chunk (negative, base units). Each line stores which lot(s) it used in `sale_line_lots` (with cost per base unit, for M10 profit). Lot items: oldest lot first by default; a line can span lots (`sale_lines.lot_id` is null then).
  - Invoice no: `settings.next_invoice_no` (default 1), 6 digits zero-padded, read + incremented inside the sale transaction, so a rollback leaves no gap. Skips a number if one already exists.
  - Held bill: a `sales` row with status `held`, no invoice number, lines saved, no stock/ledger. Recall loads it into the cart; completing or re-holding UPDATES that same row (`heldSaleId`), so no duplicate. Completing the same held bill twice fails (`HELD_NOT_FOUND`). Discard deletes the draft (never a business record: no stock, ledger or invoice) and writes an audit row.
  - Return: per line qty <= sold - returned (base units). Refund = net_total share, half-up, last piece refunds the remainder. Stock goes back to the same lot chunks (oldest chunk first). Refund `auto` = against the sale's khata first then cash; `cash` or `credit` can be forced (`credit` needs a customer; `cash` refused if the sale was on credit). Ledger `return` CREDIT. Cashier needs a manager/owner PIN; manager/owner do not.
  - Void: manager/owner PIN always + a reason. Reverses all stock to the same lots (`sale_return` movements, ref_type `sale_void`) and the khata credit part (ledger `return` CREDIT); status `void`, invoice number kept. Refused if the sale already has a return. PIN guesses lock an approver for 1 minute after 5 wrong tries.
- Insufficient stock: BLOCKED by default (`INSUFFICIENT_STOCK`, names the item). Setting `allow_negative_stock` = '1' lets items that track stock but not lots go below zero; lot items are always blocked. Items with `track_stock = 0` never touch stock. (ARCHITECTURE was silent; there is no Settings screen toggle yet, set via `settings:set`.)
- Credit limit: `parties.credit_limit` > 0 is a hard block (`CREDIT_LIMIT_EXCEEDED`, message says how much room is left); 0 = no limit. No manager override (kept simple; easy to add later).
- Files: src/main/db/migrations/003_sales.sql, src/main/db/{migrate,tx}.ts, src/main/core/sales/{service,pricing,returns,approval,queries,ipc}.ts (+service.test, returns.test), src/main/core/stock/allocator.ts, src/shared/sale-calc.ts (+test), src/shared/types/sales.ts, src/shared/ipc-contract.ts, src/preload/index.ts, src/main/ipc/register.ts, src/renderer/src/screens/SaleScreen.tsx, src/renderer/src/screens/sale/*, src/renderer/src/i18n/{en,ur}.json, docs/TASKS.md, docs/REVIEW_LOG.md
- Checks: typecheck ✅ lint ✅ tests ✅ (167 tests, 35 new). `npm run build` ✅. NOT run by hand (no interactive session here): the sale screen UI is typechecked, linted and bundled only, please click through it.
- Manual test steps:
  1. `npm run dev`, log in. Items: make "Panadol" (Box = 10) with opening stock 100 and a barcode. Parties: add a customer with credit limit 500.
  2. Sale screen: type the barcode, Enter (line added; scanning again adds qty). F2 change unit to Box. F4 give a 10% line discount. Check the total.
  3. F8, type cash, Enter: change due shows, Enter starts a new sale. Items: stock dropped; invoice 000001.
  4. Add items, F3 pick the customer, F8, All on credit (Alt+2), Enter. Parties: customer balance went up. Try more than the limit: blocked with a clear message.
  5. F5 to hold, restart the app, F6 recall, F8 complete. Only one invoice exists.
  6. F7: find an invoice, return 1 item (cashier needs a manager PIN), then void another (PIN + reason). Stock and customer balance come back.
- Open questions / deviations:
  - New migration `003_sales.sql` (append-only): bill discount columns, void columns on `sales`; `item_name`, `discount_bp`, `net_total` on `sale_lines` (the original schema had no name snapshot); `sale_line_lots`, `sale_returns`, `sale_return_lines`.
  - `shift_id` stays NULL until M9. Cash refunds/voids are not written to a cash drawer yet (M9 should read `sales.status`, `sale_returns.refund_cash`).
  - Lot-level sale prices (`stock_lots.sale_price`) are ignored; price comes from the item/pack. No price override on the sale screen.
  - Void is blocked after a return (return the rest instead). Returns are entered in base units.
  - F9 (print last) is not wired: printing is M8. The sale screen has no receipt yet.
  - Discount shortcut applies to the selected line or the whole bill; percent discounts are stored in basis points so held bills restore exactly.

### [Review] M7 — 2026-10-08
- Verdict: **approved**. Main re-prices every line, payment/credit-limit checks before writes, invoice counter inside the transaction (no gaps), stock via allocator + postMovement, khata via postEntry, module hooks inside the transaction, `db/tx.ts` shared. PIN approval has its own lockout. Typecheck + 167 tests pass. Accepted: negative stock blocked by default (`allow_negative_stock` setting, add toggle in Settings later), hard credit-limit block, held drafts may be deleted (drafts are not business records). Owner must run the M7 manual steps (UI not yet clicked through).

### [Build] M8 — Printing — 2026-10-08
- Summary: Receipts are built by PURE functions (`printing/receipt.ts`: `ReceiptData` -> HTML string, 58 mm and 80 mm, Urdu = `dir="rtl"` with Segoe UI/Tahoma fallbacks; `zreport-html.ts`, `html.ts`, `labels.ts`). `printing/service.ts` renders that HTML in a hidden BrowserWindow and calls `webContents.print({ silent: true, deviceName, margins none, pageSize { width: 58000|80000 microns, height measured from the content } })`. Settings > Printer: dropdown from `getPrintersAsync`, refresh, paper width, test print (uses the unsaved form values), print-after-sale `print_mode` auto/ask/off. New Settings tab "Sales rules" with the owner-only `allow_negative_stock` toggle. The first-run wizard printer step now uses the same picker + a real test print.
- How print failures are isolated:
  - Printing is a SEPARATE IPC call (`printing:printSale`) made by the renderer AFTER `sales:complete` has committed. The sale transaction never knows about printers.
  - Every function in `printing/service.ts` returns a `Result` and catches everything (load error, no printer, driver error, 30 s timeout); the hidden window is always destroyed in `finally`.
  - Renderer wrapper `lib/print.ts` (`printSaleSafe`) never throws; a failure shows an orange auto-closing toast ("Printing failed" + plain message, "press F9 to print again") and the sale screen carries on.
- Wiring: auto = print right after the sale (cash received passed so the receipt shows change); ask/off = a "Print receipt (P)" button on the sale-done dialog; F9 on the sale screen reprints the last sale (falls back to the newest completed invoice after a restart); "Reprint" button on the invoice detail (F7). Reprints have no "cash received/change" lines (change is never stored). Voided invoices print with a VOID banner.
- Files: src/main/core/printing/{html,labels,receipt,receipt-data,zreport-html,service,ipc}.ts (+receipt.test.ts), src/shared/types/printing.ts, src/shared/ipc-contract.ts, src/preload/index.ts, src/main/ipc/register.ts, src/renderer/src/lib/print.ts, src/renderer/src/components/PrinterFields.tsx, SettingsScreen, SetupScreen + setup/SetupSteps, SaleScreen, sale/{PaymentDialog,InvoiceDetail,ShortcutBar}, i18n en/ur, docs
- Checks: typecheck ✅ lint ✅ tests ✅ (see M9 entry for the final count) `npm run build` ✅. NOT run by hand and NOT tested on a real printer (owner does the M8 "Done when" on Windows).
- Manual test steps:
  1. Settings > Printer: pick the thermal printer, choose 80 mm (or 58 mm), press Test print. Save.
  2. Open a shift (Cash screen), make a sale: the receipt prints by itself. Switch "Print receipt after sale" to Ask, sell again: use the Print button (or P) on the done dialog.
  3. Sale screen F9 reprints the last receipt. F7 > invoice > Reprint.
  4. Switch the printer off (or choose a wrong name) and sell: sale still completes, orange toast appears.
  5. Switch language to Urdu and print: Urdu labels and item names should read right-to-left.
- Open questions / deviations:
  - Receipt labels live in `printing/labels.ts` (en + ur), not the renderer i18n files, because the HTML is built in the main process.
  - Default `print_mode` is `auto` (key absent = auto). With no printer chosen, auto shows the "No printer chosen" toast on every sale.
  - Urdu uses system fonts (Segoe UI/Tahoma; Nastaliq only if installed). Needs a look on the real printer; thermal printers rasterise, so small Urdu text on 58 mm may be hard to read.
  - Electron `PrinterInfo.isDefault` is missing from the typings of this version, read through a cast.

### [Build] M9 — Cash shifts + day end — 2026-10-08
- Summary: Migration `004_cash.sql` adds a partial unique index (only ONE open shift, enforced by the DB too) and shift tags: `sales.void_shift_id`, `sale_returns.shift_id`, `purchases.shift_id`, `party_ledger.shift_id` (`sales.shift_id` already existed). `cash/service.ts`: open shift, cash in/out/expense entries, close shift (stores expected, counted; difference = counted - expected), `computeShiftCash`; `cash/zreport.ts`: Z report (also works on an open shift as a live "so far" report). Cash screen: open shift, live expected-cash card, add entry, close with counted cash and live difference, history of closed shifts, Z report modal (print on the receipt printer, or window.print of the page).
- Sale with no open shift: BLOCKED. `completeSale` aborts with `NO_OPEN_SHIFT` before anything is written (no invoice number used). The sale screen shows an orange banner and opens the "Open shift" dialog on load and on F8/Pay; holding a bill is still allowed without a shift. A completed sale (also a recalled held bill) stores the open shift's id in `sales.shift_id` inside the sale transaction.
- Expected cash as implemented: `opening + cash sales - cash refunds + cash in - cash out - expenses - paid to suppliers + khata received from customers`.
  - cash sales = SUM(`sales.paid_cash`) with that `shift_id` (verified: paid_cash = total - credit, i.e. cash kept; change is never stored so it is not counted).
  - cash refunds = `sale_returns.refund_cash` with that shift + `paid_cash` of sales voided while that shift was open (`void_shift_id`). Sold and voided in the same shift nets to 0.
  - paid to suppliers = `purchases.paid` (M6 cash paid with a purchase) + standalone supplier `payment_out` (M5 payments).
  - khata received = standalone customer `payment_in`.
  - Anything that happens with NO open shift is not tracked (shift_id NULL). A refund/void after a shift is closed is not added to that closed shift, it goes to the shift open at that time.
- Z report: invoices count, gross, discounts, net, paid by cash / on credit, returns (count, total), voids (count, total), cash drawer lines, expected, counted, difference, every cash entry. Voided sales are excluded from sales totals.
- Files: src/main/db/migrations/004_cash.sql, src/main/db/migrate.ts, src/main/core/cash/{service,zreport,ipc}.ts (+service.test.ts), src/main/core/sales/{service,returns}.ts (+ both tests now open a shift in setup), src/main/core/purchases/service.ts, src/main/core/ledger/service.ts, src/shared/types/cash.ts, ipc-contract, preload, register.ts, src/renderer/src/screens/{CashScreen,SaleScreen}.tsx, screens/cash/{OpenShiftDialog,ZReportView,ZReportModal}.tsx, i18n en/ur, docs
- Checks: typecheck ✅ lint ✅ tests ✅ (194 tests, 27 new: 9 receipt/report HTML, 18 cash). `npm run build` ✅. NOT clicked through by hand (no interactive session).
- Manual test steps:
  1. `npm run dev`, Sale screen: banner + Open shift dialog appears. Enter opening cash.
  2. Sell something for cash, one on credit, make a return and a void (F7).
  3. Cash screen: add a Cash in, a Cash out (note), an Expense (note). Expected cash matches your arithmetic.
  4. Enter counted cash: difference shows live. Close shift: Z report opens, print it.
  5. Try selling after closing: blocked until a new shift is opened.
- Open questions / deviations:
  - Customer/supplier payments have no payment method in M5, so ALL of them are treated as cash. Bank/online payments would need a method field (later).
  - Sale returns and voids do not require an open shift (the cash is simply untracked if none is open). Say if you want them blocked too.
  - A sale voided in a LATER shift than it was sold: the old closed shift keeps its stored expected cash; the refund is charged to the shift open at void time. Its live Z report will show the sale as voided.
  - Any role (including cashier) can open/close a shift and see the Z report; no manager approval for a non-zero difference.
  - Purchase returns involve no cash in this app (they only reduce the supplier balance), so they are not in the drawer.

### [Review] M8 + M9 — 2026-10-08
- Verdict: **approved**. Printing is a separate call after the sale commits, never throws, hidden sandboxed window with escaped HTML (reviewer set `javascript: false`). One-open-shift enforced by unique partial index; sales blocked without a shift; expected cash covers sales, refunds, voids, cash in/out, expenses, supplier payments and khata receipts. Typecheck + 194 tests pass. Owner to test: real 58/80 mm printer on Windows incl. Urdu text; khata payments are treated as cash for now.

### [Build] M10 — Reports — 2026-10-08
- Summary: Owner-only Reports screen with 5 tabs: Sales & profit (group by day / item / user, date range with Today / This month shortcuts), Stock value, Low stock, Customers owe (receivables), We owe suppliers (payables). Every table has Print (`window.print`, `.print-area`) and Export CSV (renderer sends the table, the save dialog and file write happen in main; UTF-8 BOM so Excel shows Urdu; text starting with `= + - @` gets a leading apostrophe against formula injection). `src/shared/csv.ts` got `toCsv`/`csvField`. Reports menu item is hidden for non-owners and every `reports:*` IPC checks `owner`.
- Profit cost source: migration `005_reports.sql` adds `sale_lines.cost_total` (paisa, frozen when the sale is completed). The sale service fills it: stock-tracked lines = SUM(chunk qty x `sale_line_lots.cost_price`) (lot cost, else item cost at that moment); lines of items without stock tracking = `qty_base x items.cost_price` at sale time (these have no lot chunks, so a snapshot column was needed). The migration backfills older rows from the chunks, else the item's current cost. Profit = SUM(`net_total`) - returns (`sale_return_lines.line_total`, by return date) - cost (`cost_total` minus `cost_total x returned qty / sold qty` for returned goods). Voided sales are excluded. Returns count for the day and the user who made the return.
- Stock value: lot-tracked items valued lot by lot (lot cost), plus any lot-less remainder at item cost; others `stock_cache x cost_price`; only active, stock-tracked, qty > 0. Low stock: active, `track_stock`, `stock_cache <= reorder_level`. Receivables / payables from `SUM(debit) - SUM(credit)` (customer > 0 owes us; supplier < 0 we owe), only non-zero in the "right" direction.
- Performance: one grouped query for sales and one for returns per report (merged in JS), no per-row queries. New indexes: `sales(created_at)`, `sale_returns(created_at)`, `sale_lines(item_id)`, `party_ledger(party_id)`.
- Files: src/main/db/migrations/005_reports.sql, src/main/db/migrate.ts (+test), src/main/core/sales/service.ts, src/main/core/reports/{service,ipc}.ts (+service.test.ts), src/shared/csv.ts (+test), src/shared/types/reports.ts, ipc-contract, preload, register.ts, src/renderer/src/screens/ReportsScreen.tsx, screens/reports/{ReportTable,SalesReportTab,StockAndBalanceTabs}.tsx, app/layout.tsx, i18n en/ur
- Checks: typecheck ✅ lint ✅ tests ✅ (218 tests, 24 new across M10 + M11: 9 reports, 2 CSV writer, 1 migration backfill). `npm run build` ✅. NOT clicked through by hand (no interactive session).
- Manual test steps:
  1. Make a few sales (one with a discount, one on khata), a return and a void; buy stock on credit from a supplier.
  2. Reports > Sales & profit: switch Day / Item / User, change dates; check sales - returns - cost = profit.
  3. Stock value, Low stock, Customers owe, We owe suppliers: compare with Items and Parties screens.
  4. Print (Ctrl+P preview shows only the table) and Export CSV; open the CSV in Excel, Urdu names should show.
  5. Log in as manager/cashier: no Reports menu item.
- Open questions / deviations:
  - Returns are reported on the day the return was made (not the sale day), so a day can show negative profit.
  - Sales before this migration whose item has no stock tracking use the item's CURRENT cost (old data had no snapshot).
  - Report tables are not paginated (fine up to a few thousand items; revisit if a shop has far more).
  - CSV headers are in the UI language at export time.

### [Build] M11 — Backup & restore — 2026-10-08
- Summary: Settings > Backup & Restore tab (owner only): last backup time, Backup now, optional extra folder (USB), list of saved backups with Restore, and Restore from file. Auto backup: once on the first launch of each day (5 s after start) and when the app closes (only if shop data changed since the last backup, so a busy day does not push daily history out of the "keep N" window). Keeps the last 30 (setting `backup_keep`, 1-365) in `userData/backups/shop-YYYYMMDD-HHmm.db` and in the extra folder. A failing extra folder (USB removed) never fails the main backup; the user gets an orange toast.
- Backup safety: uses `db.backup()` (online API, never copies the live file); writes `<name>.tmp`, switches the copy to the rollback journal (single self-contained file, no -wal/-shm), runs `integrity_check`, fsyncs, then renames. Leftover `.tmp` files from a power cut are deleted on the next run. Same-minute backups get `-2`, `-3`... instead of overwriting.
- Restore safety (owner only, `backup:pickFile` then `backup:restore`): the file dialog result is validated up front; restore accepts only a listed backup name or the file picked via the dialog (never a renderer-sent path). Steps: copy to `shop.db.restore.tmp` next to the live DB -> validate (SQLite header, `integrity_check`, required tables, every core migration id known to this app, so a DB from a newer app is refused) -> safety backup `backups/pre-restore-<date>-<time>-<n>.db` of the current data (last 5 kept, not part of daily rotation) -> close DB -> delete old -wal/-shm -> rename over `shop.db` -> reopen, run migrations + module init -> audit `backup_restored` (written into the restored DB, since the old one is gone; user id used only if that user exists there) -> `app.relaunch()` + exit. Any failure before the DB is closed leaves the current data untouched. The renderer shows a confirm dialog (i18n) before restore.
- Files: src/main/core/backup/{service,ipc}.ts (+service.test.ts), src/main/index.ts (startup + close backup), register.ts, ipc-contract, preload, src/shared/types/reports.ts (backup types), src/renderer/src/screens/settings/BackupTab.tsx, SettingsScreen.tsx, i18n en/ur
- Checks: typecheck ✅ lint ✅ tests ✅ (218 tests, 12 new in backup). `npm run build` ✅. NOT clicked through by hand; the relaunch and native file dialogs need a real run (`npm run dev`).
- Manual test steps:
  1. Settings > Backup & Restore > Backup now: a new file appears in the list; "Last backup" updates.
  2. Choose an extra folder, Backup now: same file appears there. Unplug/rename the folder, Backup now: orange warning, main backup still saved.
  3. Add an item, then Restore the earlier backup: confirm; app restarts without the item; `backups/` has a `pre-restore-*` file.
  4. Restore from file... with a random .db or .txt: clear red error, nothing changes.
  5. Close the app after a sale, reopen: a new backup was made on close.
- Open questions / deviations:
  - Validation of module migration ids (`pharmacy/...`) is not checked against the installed modules; only core migrations are compared to this app's list.
  - Restore keeps the same device; the shop's `userData` path is used as-is (no cross-PC path handling needed).
  - If the app is killed during the 8 s close-backup window the close backup is simply skipped (the daily one still exists).

### [Review] M10 + M11 — 2026-10-08
- Verdict: **approved**. Profit uses cost frozen on the sale line (`cost_total`, migration 005, lot-chunk cost). Voids excluded, returns subtracted. Backups use `db.backup()` → tmp → integrity check → fsync → rename. Restore validates a private copy, takes a safety backup, removes old -wal/-shm, swaps and migrates. Typecheck + 218 tests pass. Owner to test: backup now, restore + relaunch on Windows.
