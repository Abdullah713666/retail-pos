# Prompts to paste into Gemini

Open Gemini (CLI or IDE agent) **inside this folder** (`~/Desktop/retail-pos`) so it can read and write the files.

## 1. Start a milestone

```
You are the builder for this project. First read GEMINI.md, then docs/ARCHITECTURE.md, docs/TASKS.md and docs/REVIEW_LOG.md completely.

Do ONLY the first unfinished milestone in docs/TASKS.md. Follow ARCHITECTURE.md exactly; do not change the stack or structure. If anything is unclear, write the question in docs/REVIEW_LOG.md and stop instead of guessing.

When finished: run typecheck, lint and tests until they pass, tick the boxes in TASKS.md, add a [Build] entry to the top of REVIEW_LOG.md, then stop and give me the short report described in GEMINI.md. Do not start the next milestone.
```

## 2. Apply review fixes

```
Read GEMINI.md, then the newest [Review] entry in docs/REVIEW_LOG.md. Apply every numbered fix exactly as written, nothing else. Run typecheck, lint and tests until they pass. Then add a short [Build] entry ("Fixes for Mx") listing what you changed per fix number, and stop.
```

## 3. When Gemini gets stuck or loops

```
Stop. Do not change more files. Tell me in 5 lines: what you were trying to do, the exact error message, which file, what you already tried, and what you think the cause is.
```
Then send that 5-line answer to Claude.
