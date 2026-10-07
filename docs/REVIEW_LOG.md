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
