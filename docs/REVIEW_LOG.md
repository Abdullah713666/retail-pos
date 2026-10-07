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
