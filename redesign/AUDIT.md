# Phase 0 — Audit

Read-only. Nothing in the app changed. Every number below is produced by
`redesign/census.mjs`, not estimated.

## Verdict

The app is not badly built — the JS is dense, commented and correct. The problem
is that **there is no styling system at all**: 178 hand-named classes and 625
lines of CSS in which no value is derived from any other value. Every screen was
styled locally, so every screen looks locally reasonable and globally arbitrary.

That is why previous "fix the UI" passes failed. There was nothing to fix
*against*. A tweak to a stylesheet with no source of truth is just another
stratum.

## Value census

| | Distinct values | Should be | Evidence of ad-hoc-ness |
|---|---|---|---|
| Font sizes | **25** | 7 | `12px×22`, `12.5px×17`, `13px×17`, `11.5px×11` … |
| **Half-pixel font sizes** | **8** | 0 | 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5, 16.5 |
| Colour literals | **48** | 0 outside tokens | `#0e9f6e`, `#26d07c`, `#04140c`, `#5ee7a5`, `#a86e00` … |
| Radii | **18** | 5 | 999, 9, 12, 3, 5, 8, 10, 11, 13, 14, **3.5**, 4, 6, 1, 16, 19, 2, 7 |
| Spacing values | **27** | 9 | 16, 4, 8, 14, 10, 12, 6, 9, 2, 3, 7, 13, 18, 11, 20, 5, 1, 15, 22, 24, 26, 28, 30, 56, 84, 104 |
| Shadows | 8 | 4 levels | all black-on-near-black — see defect 8 |
| CSS classes | **178** | a named component set | `.hmet`, `.hmid`, `.hpl`, `.hright`, `.hrow`, `.hsym`, `.hval`, `.hspark`, `.hsplit`, `.htip`, `.htips` |

Half-pixel sizes and a 3.5px radius are the signature of nudging individual
elements until they looked right, which is the definition of no system.

## Inline styles

| Location | Count |
|---|---|
| `style=` in `index.html` | **40** |
| Inline styles emitted from JS | **166** |

166 is materially worse than the brief's estimate and is the single biggest task
in Phases 4–6: every one is a component that was never defined.

## Emoji used as interface iconography — 13 distinct, 36 occurrences

| | Where | Purpose it is standing in for |
|---|---|---|
| `☁️` | index.html:29, portfolio.js:832 | cloud/restore icon |
| `👀` | index.html:49 | "view" icon |
| `💬` | index.html:57, 59 | assistant FAB |
| `➤` | index.html:62 | send button |
| `✕` | index.html:59, 144, portfolio.js:312 (+6) | close |
| `⚙︎` | index.html:136, api.js:332, insights.js:540 (+5) | settings — **also used inside body copy** |
| `☆` `★` | index.html:150, 161, sheets.js:76 | watchlist toggle |
| `🔔` | api.js:335, portfolio.js:703, 853 | alerts |
| `🔒` | insights.js:538, 540, portfolio.js:787 | locked/tax |
| `💵` `🎯` `🏦` | insights.js:681, 724, 728 | income / goal / account |

These sit beside hand-rolled SVG paths, so the iconography is visibly two
different languages.

## Confirmation of the §0 defects

Verified in source, with corrections where the brief was inaccurate:

| # | Claim | Verdict |
|---|---|---|
| 1 | Stylesheet is accreted strata | **Partly stale.** Only **one** version-stamped comment survives (`/* ---------- v6 finish ---------- */`), not the `v5`/`v9.3`/`v9.4`/`v3.1`/`v3.2` series the brief lists — those appear to have been cleaned up already. But **4 duplicate selectors** remain (`#miniBar`, `.badge`, `.hdr-actions button:hover`, `.hrow`), more than the 2 claimed. The underlying diagnosis holds. |
| 2 | Brand colour == profit colour | **Confirmed exactly.** Dark: `--green:#26d07c` and `--brand:#26d07c`. Light: `--green:#0e9f6e` and `--brand:#0e9f6e`. Byte-identical in both themes. |
| 3 | No type scale | **Confirmed, worse than stated** — 25 sizes, not ~21. |
| 4 | Radius/spacing tokens ignored | **Confirmed** — 18 radii and 27 spacing values against 4 defined radius tokens. |
| 5 | Inline styles in markup | **Confirmed, far worse** — 40 in HTML *plus* 166 from JS. |
| 6 | Emoji as iconography | **Confirmed** — 13 distinct, table above. |
| 7 | Every box the same weight | **Confirmed** — `.card`, `.icard`, `.stat`, `.chip`, `.buybox`, `.searchbar`, `.idx-card` all `1px solid var(--line)` + radius + shadow. |
| 8 | Elevation invisible | **Confirmed** — `0 18px 44px rgba(0,0,0,.42)` over `#0b0f0d` renders nothing. |
| 9 | Decoration substituting for design | **Confirmed** — grain overlay, radial brand glow, `nth-child` entrance stagger, backdrop-blur on tab bar and mini bar. |
| 10 | No layout system | **Confirmed** — `.wrap{max-width:600px}` is the entire strategy. |
| 11 | Inputs below 16px | **Confirmed, different selectors than stated.** Actually `.tgtedit-row input` 14px, `.goalset input` 15px, `.searchbar input` 15px. The brief named `.etable`/`.buyrow`/`.tgtplan`; those are now ≥16px. Three offenders, not the three named. |
| 12 | Developer-voice copy | **Confirmed live in demo mode**: "👀 View the example portfolio — no login", "DEMO · example data · tap to exit". |

## Additional defects found

13. **Chart.js is loaded from a CDN** — `index.html:16` pulls
    `cdnjs.cloudflare.com/.../chart.umd.min.js`. The app therefore **cannot chart
    offline**, which contradicts the offline requirement in Phases 7–8. Must be
    vendored locally. Not mentioned in the brief.
14. **`⚙︎` appears inside body copy**, not just as an icon — so removing emoji
    from chrome is not sufficient; the copy rewrite has to catch it too.
15. **Two icon languages** — inline `<svg>` path strings are built inside JS
    template literals (e.g. `app.js:224–228` builds the theme icon twice, once
    per branch), so the same glyph is duplicated rather than referenced.

## Baseline for the preservation contract

`redesign/baseline-numbers.txt` — **374 numeric tokens** captured from
`document.body.innerText` in demo mode: portfolio 126, markets 16, insights 232.
Sorted, so that the heavy DOM reordering the redesign performs cannot be mistaken
for a changed calculation. Regenerate with `redesign/extract-numbers.js` in
Phase 8 and diff.

`markets` is only 16 tokens because the Explore tab's index and screener data
needs a live network fetch that demo mode does not populate. Noted so the Phase 8
diff is compared like-for-like rather than read as data loss.

## Deviation from the brief

The brief asks for 12 before-screenshots. The owner explicitly asked mid-phase to
skip the screenshot sweep ("i know how the app looks"), so `redesign/before/` is
not populated and `COMPARISON.md` in Phase 8 will be a written comparison rather
than image pairs. `redesign/capture.mjs` retains a `--shots` flag if that is ever
wanted; the number capture, which the preservation contract depends on, was kept
and ran.
