# Tasks

Work on **one milestone at a time, top to bottom**. Do not start the next milestone until the current one is reviewed and approved.
Mark items `[x]` when done. Each milestone ends with: typecheck + lint + tests passing, and an entry in `docs/REVIEW_LOG.md`.

## M0 — Project scaffold
- [x] electron-vite + React + TypeScript (strict) project in this folder (keep existing docs and md files)
- [x] Install Mantine v7, @tabler/icons-react, react-router-dom, zod, i18next, react-i18next, better-sqlite3, vitest, electron-builder, ESLint + Prettier
- [x] Folder structure exactly as in ARCHITECTURE.md §4 (empty placeholder files are fine)
- [x] Secure BrowserWindow (§3), window min size 1280×720, opens maximized
- [x] App layout: left sidebar menu + main area; placeholder screens for Sale, Items, Parties, Purchases, Cash, Reports, Settings
- [x] npm scripts: `dev`, `typecheck`, `lint`, `test`, `build:linux`, `build:win`
- [x] `.gitignore` covers node_modules, out, dist, release, *.db
- **Done when:** `npm run dev` opens the window on Linux Mint, sidebar navigation works, all scripts pass.

## M1 — Database + shared basics
- [x] `src/shared/money.ts` (toPaisa, fromPaisa, formatPKR "Rs 1,234.50", multiply price×qty with half-up rounding) + tests
- [x] `src/shared/result.ts` Result type; IPC handler helper that validates with zod and catches errors
- [x] `db/connection.ts` with pragmas (§5), `db/migrate.ts` runner, `001_core.sql` with all tables + indexes from §6
- [x] Test helper: create in-memory DB with migrations applied
- [x] Error screen if migrations fail
- **Done when:** app starts and creates `shop.db`; tests prove migrations apply on an empty DB and are idempotent.

## M2 — Module system skeleton
- [x] Main `MainModule` + renderer `UiModule` interfaces (§7), registry reading `settings.enabled_modules`
- [x] Module migrations run after core
- [x] Empty `pharmacy` module that adds one migration and one menu item ("Expiry") with a placeholder screen
- **Done when:** with pharmacy enabled the menu item appears; with it disabled it doesn't; app works either way.

## M3 — Settings, users, first-run wizard, login
- [x] Settings service + IPC (get/set typed keys)
- [x] Users service: create, list, deactivate, PIN hash (Node `crypto.scrypt`), verify PIN; roles
- [x] First-run wizard (§8.8) — printer test can be a stub until M8
- [x] Login screen: pick user, enter PIN (numeric keypad on screen + keyboard)
- [x] Role-based menu hiding and IPC permission checks (`modules:setEnabled` and settings writes = owner only)
- [x] i18n set up; all new strings in en.json + ur.json; language switch in Settings
- **Done when:** fresh install → wizard → login → Sale screen; cashier can't open Settings.

## M4 — Items
- [x] Items service: create/update/deactivate, units (packs), categories, search (name/alias/barcode), barcode lookup
- [x] Items screen: searchable table, add/edit form with units, keyboard friendly
- [x] CSV import (name, barcode, category, base unit, sale price, cost_price, pack name, pack factor) with preview + error rows
- [x] Opening stock entry (creates `opening` movements)
- **Done when:** can import 5,000 items from CSV in < 10 s and search returns in < 100 ms.

## M5 — Parties + khata
- [x] Customers and suppliers CRUD, opening balance
- [x] Ledger service: post entries, balance, statement between dates
- [x] Receive payment / make payment screens; party statement printable
- **Done when:** ledger tests pass and balances match statements.

## M6 — Purchases (stock in)
- [x] Purchase entry: supplier, bill no, lines (item, unit, qty, cost, lot no + expiry when item tracks lots)
- [x] Posts stock movements + lots + supplier ledger (credit purchase) in one transaction
- [x] Purchase return
- **Done when:** stock and supplier balance update correctly (tests).

## M7 — Sale screen (the most important screen)
- [ ] Layout per ARCHITECTURE §8: search bar, line grid, totals panel, shortcut bar
- [ ] Add by search or barcode scan; change unit (F2); qty edit; line/bill discount (F4)
- [ ] Customer select (F3) for credit sale; payment dialog (F8): cash, credit, mixed; change due
- [ ] Hold/recall bills (F5/F6), persisted
- [ ] Sale service: recalculates totals, allocates stock via allocator, posts movements + ledger, invoice number — one transaction
- [ ] Sale return / void (manager PIN), audit log
- **Done when:** a full sale can be done with keyboard only in < 15 s; tests cover totals, stock, ledger, void.

## M8 — Printing
- [ ] Receipt templates 58 mm + 80 mm; printer selection + test print in Settings
- [ ] Print after sale (setting: auto/ask/off), reprint F9; failures never break the sale
- **Done when:** prints correctly on a real thermal printer (owner tests on Windows).

## M9 — Cash shifts + day end
- [ ] Open shift (opening cash), cash in/out/expense, close shift (count cash, show difference)
- [ ] Day-end (Z) report printable
- **Done when:** expected cash = opening + cash sales + cash in − cash out − expenses (tests).

## M10 — Reports
- [ ] Sales by day/item/user, profit (sale − cost), stock value, low stock, customer receivables, supplier payables
- [ ] Date range filter, print, export CSV

## M11 — Backup & restore
- [ ] Auto backup (§10), backup now, extra folder, restore (owner only)

## M12 — Pharmacy module (full)
- [ ] `pharmacy_item_info` fields on item form; lots + expiry required on purchase
- [ ] FEFO allocator; block expired lots (owner override + audit)
- [ ] Sale line shows batch + expiry
- [ ] Expiry console (30/60/90 days, by supplier, printable + copy as WhatsApp text)
- [ ] Want-book (auto + manual), grouped by supplier, copy as WhatsApp text
- [ ] Dashboard widget: near-expiry count, want-book count

## M13 — Windows release
- [ ] GitHub Actions workflow building NSIS installer on windows-latest
- [ ] App icon, name, version; installer creates desktop shortcut
- [ ] Owner tests install on a Windows 10 PC: install, wizard, sale, print, backup, uninstall/reinstall keeps data
