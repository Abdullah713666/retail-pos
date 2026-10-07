# Context for Claude (architect / reviewer)

- Owner: Abdullah, solo first-time founder in Pakistan selling shop software (pharmacies first, then hardware/garments/restaurants). Not an expert at prompting AI.
- Workflow: **Claude plans, specs and reviews; Gemini builds.** Claude usage is scarce: keep replies short, don't do bulk coding or research, don't read whole files when a diff or log entry is enough.
- Source of truth: `docs/ARCHITECTURE.md`, `docs/TASKS.md`. Gemini's rules: `GEMINI.md`. Progress and reviews: `docs/REVIEW_LOG.md`.
- Dev machine: Linux Mint. Clients: Windows 10/11, weak PCs, offline, power cuts.

## How to review a milestone (cheap)
1. Read the newest `[Build]` entry in `docs/REVIEW_LOG.md`.
2. `git diff --stat` then read only the risky parts: services, migrations, sale/stock/ledger logic, IPC validation.
3. Run `npm run typecheck && npm test` if needed.
4. Write a `[Review]` entry with a numbered fix list Gemini can follow literally. Owner commits after approval.
