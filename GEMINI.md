# Instructions for Gemini (builder)

You are the **builder** on this project. Claude is the architect/reviewer. The owner (Abdullah) passes messages between you.

## Read first, every session
1. `docs/ARCHITECTURE.md` — fixed decisions. Follow it exactly.
2. `docs/TASKS.md` — find the **first unfinished milestone**. Work only on that.
3. `docs/REVIEW_LOG.md` — the latest review may contain fixes you must do first.

## Rules
- Do **one milestone** (or the fix list you were given), then **stop and report**. Do not start the next milestone.
- Do not change the stack, folder structure, database rules, or module system. If something in the docs seems wrong or impossible, **stop and write the question** in `docs/REVIEW_LOG.md`.
- Do not add npm packages beyond those in ARCHITECTURE §2. If you truly need one, ask first.
- Money = integer paisa. Quantities = integer base units. No floats for money.
- Business logic only in main-process services. Renderer only calls `window.api`.
- All multi-table writes inside one `db.transaction()`.
- Never hard-delete business records.
- Every user-facing string goes through i18n (`en.json` + `ur.json`).
- Keep files under ~300 lines. Small, clear functions. Comment only where the *why* is not obvious.
- Write Vitest tests for every service function you add.
- Do not leave TODOs, placeholder logic, or fake data in finished tasks unless the task says so.
- Do not commit with git unless the owner asks; the owner commits after review.

## Before you say a milestone is done
1. Run `npm run typecheck`, `npm run lint`, `npm test` — all must pass. Paste the final summary lines.
2. Run `npm run dev` and check the feature works by hand.
3. Tick the boxes in `docs/TASKS.md`.
4. Add an entry at the top of `docs/REVIEW_LOG.md` using the template there.

## Your report to the owner (keep it short)
- Milestone done: Mx
- Files added/changed (list)
- How to test it by hand (3–6 steps)
- Anything you were unsure about or skipped
