# Retail POS

Offline-first Windows POS for small shops in Pakistan. One shared core + industry modules (pharmacy first).

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Task list: [docs/TASKS.md](docs/TASKS.md)
- Build/review history: [docs/REVIEW_LOG.md](docs/REVIEW_LOG.md)

## Working loop
1. Give Gemini the prompt in [docs/GEMINI_PROMPTS.md](docs/GEMINI_PROMPTS.md) → it builds one milestone and reports.
2. Ask Claude: "Review milestone Mx" → Claude writes a fix list in the review log.
3. Give Gemini the "fix" prompt → repeat until approved.
4. Commit: `git add -A && git commit -m "Mx: <title>"`.

## Run (after M0)
```
npm install
npm run dev
```
