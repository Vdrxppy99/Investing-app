# Redesign status — where the `redesign` branch actually stands

Honest accounting, so the next session does not have to rediscover it.

## Complete and committed

| Phase | Commit | State |
|---|---|---|
| 0 — Audit + baseline | `356892c` | done |
| 1 — DESIGN.md + wireframes + contrast | `1c9b320` | done |
| 2 — Tokens, primitives, gallery | `834f028` | done |
| 3 — Face ID front door + lock screen | `2b52b9f` | done |

## Not started

Phases 4–8. The remaining work is the markup rewrite, and it is the bulk of the
project:

| File | Inline styles to remove | innerHTML sites |
|---|---|---|
| `js/portfolio.js` | 38 | 25 |
| `js/insights.js` | 35 | — |
| `js/app.js` | 22 | — |
| `js/sheets.js` | 15 | — |
| `js/explore.js` | 7 | — |
| `js/core.js` | 3 | — |
| `index.html` (3 page bodies) | 26 | — |
| **total** | **146** | |

Every one of those is a component that was never defined. They now have
definitions (`css/components.css`, `js/ui.js`) — they need to be *used*.

## Current visual state — read this before opening the app

`css/app.css` is deleted and the three page bodies still carry the old markup,
so **Portfolio / Explore / Insights are unstyled right now**. The brief calls
this out as expected and correct at the end of Phase 2: those screens are meant
to be rebuilt in Phases 4–6, not patched to keep working.

What IS finished and worth looking at:

- `dev/components.html` — the full component gallery, both themes
- the lock screen — rebuilt, 0 inline styles, 0 emoji, Face ID first

## Nothing shipped

No commits are pushed. GitHub Pages still serves the old working app, so the
native Portfolio wrapper on the phone is unaffected. `git checkout main` returns
to the working app at any time.

## Known issue that blocks Phase 8

Chart.js is loaded from a CDN (`index.html:16`), so the app cannot chart offline.
Phase 7/8 require full offline operation. It must be vendored locally before
those phases can pass. Found in Phase 0; not in the original brief.

## Suggested order for the next session

1. **Phase 4** — Portfolio. Hero (`.hero`, no card), chart card, holdings via
   `ui.row()`, demoted modules to `ui.disclose()` on mobile / `.split__side` at
   ≥1024px. Wire the nav rail.
2. **Phase 5** — Insights is the higher-value half: `ui.group()` already exists
   for the four-group restructure. Explore's three screener cards collapse into
   one `ui.seg()`.
3. **Phase 6** — sheets/modal/assistant via `ui.sheet()` / `ui.modal()`.
4. **Phase 7** — vendor Chart.js, then the native checklist.
5. **Phase 8** — `node redesign/capture.mjs after`, diff against
   `redesign/baseline-numbers.txt` (374 tokens), run the seven purity checks.
