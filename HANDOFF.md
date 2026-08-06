# HANDOFF.md — read this first

You are picking up an in-flight project from a previous Cowork session that has
no shared history with you. Everything you need is in this repo. Read this file
completely before doing anything else.

---

## 1. What this project is

A personal investment portfolio **display** app (no trading) for Isaac, a
student. Live at `https://vdrxppy99.github.io/Investing-app/`.

- Vanilla JS, **no build step**, no module system. Scripts share one global
  scope and load in a fixed order from `index.html`. A symbol renamed in
  `core.js` silently breaks every later file.
- PWA with a service worker, offline-first.
- AES-256-GCM encrypted vault in localStorage, unlocked by passcode (PBKDF2
  310k) or WebAuthn PRF passkey.
- A Cloudflare Worker for cloud backup and an AI endpoint.
- An iOS Swift WKWebView shell in `native/` (currently uninstalled — the free
  Apple provisioning profile expired).
- EN/DE i18n.

**Holdings are US-domiciled Vanguard funds held in a US account.** Isaac is in
Germany on study abroad. Earlier work briefly assumed EU/UCITS and German tax;
that was wrong and is corrected in `DATA-SOURCES.md`. Vorabpauschale,
Teilfreistellung and the Sparerpauschbetrag do **not** apply.

**This is going on his resume.** That matters for two reasons: it must not look
like a clone of another app, and it must work when someone opens it on a laptop.

---

## 2. Your role — this is the important part

**You do not write code. You write the prompts that Claude Code executes.**

Isaac runs Claude Code separately, on Sonnet at high effort, in accept-edits
mode. He pastes your prompt in, lets it run to completion, then pastes the
output back to you. Your job each turn is:

1. Read the output critically. Verify claims against the repo yourself where you
   can — sessions have reported work complete when it was not.
2. Catch what it got wrong, what it silently dropped, and what its own
   footnotes flagged but it did not act on.
3. Update the spec and plan files when a decision changes.
4. Write the next prompt.

He has limited usage. Be economical: no preamble, no restating his own output
back to him, no recapping work he just watched happen.

**Context is 200k.** Size every prompt for it: one concern per session, an
explicit file list, and a hard screenshot budget. He starts a fresh Claude Code
chat for every phase, which is correct and should continue.

---

## 3. The prompt harness — use this shape every time

Every prompt follows this structure. It exists because each rule was earned by
something going wrong.

```
Read CLAUDE.md, then <the relevant spec file>. <One-line statement of the job.>

Skills: <only the 3-5 needed>. Nothing else.
<N> screenshots maximum.

HARD STOP RULES — these override any instinct to be helpful:
- Do the work of this session only. When the checkboxes are green, STOP.
  Do not begin the next phase. End your turn.
- Do not modify any file this work does not require. If you are about to touch
  a file outside its scope, STOP and ask first.
- Do not run `git commit`, `git push`, `git checkout`, `git reset`, or delete
  any file. Leave changes in the working tree for review.
- Do not revert the owner scope decisions in CLAUDE.md.
- If you get blocked, or the plan turns out to be wrong, STOP and say so.
  Do not improvise a different approach.
- If you notice something worth fixing that is not in this session, write it
  down in one line at the end. Do not fix it.

<The actual work, with specific file:line references wherever known.>

Do not stop to ask for approval along the way. State your plan at the top of
your first message, then carry it out in one continuous run. Accept-edits mode
is on and the complete diff will be reviewed at the end.

sw-release checklist. Run the full suite. No figure in the golden master may
move. Do not push.

When you stop: git status, git diff --stat, and each acceptance item with the
command you ran and its output. "Looks correct" is not evidence.
```

Vary the middle. Keep the frame.

---

## 4. Working agreements that must not be dropped

**Evidence, not assertion.** Screenshots do not prove that something scrolls,
that a chart renders at the right pixel ratio, or that a control is wired.
Demand `scrollHeight` vs `clientHeight`, `canvas.width` vs
`getBoundingClientRect().width`, DOM attribute reads. Three separate sessions
reported a sheet-scroll bug fixed while it was still broken, each with a
screenshot as proof.

**Never fabricate data.** If a free data source cannot be made to work, the
correct outcome is shipping without that feature and saying so — never a
plausible-looking invented date or figure.

**The golden master is the contract.** `test/golden/golden-master.json` holds
every displayed financial figure. Any change that moves one is a finding, not a
nuisance. It may only be regenerated after each moved figure is individually
justified — never to make a test go quiet.

**Backlog discipline.** Anything noticed out of scope goes into
`UPGRADE_PLAN.md`'s Backlog with a `file:line`. A backlog nobody can trust is
worse than none: one entry was already mis-transcribed and had to be
reconciled.

**Crypto is different.** Never let a session change `js/vault.js` speculatively.
A wrong "fix" to key wrapping locks Isaac out of his own data permanently, with
no recovery. Report first; fix only what a concrete failing case demonstrates.

---

## 5. Repo artifacts — what each file is for

| File | Role |
|---|---|
| `CLAUDE.md` | Architecture, the scope decisions that must not be reverted, the service-worker rules. Every session reads this first. |
| `UPGRADE_PLAN.md` | The phased plan, acceptance criteria per phase, and the Backlog. |
| `DESIGN-TARGET.md` | The approved visual spec. **"Home v2" at the bottom supersedes the Home section above it.** |
| `design/target/five-tabs.html` | Rendered visual reference, five frames. ~40KB — never have a session read it as a file; it should be opened in a browser. |
| `DATA-SOURCES.md` | Verified free-tier data feeds, plus two live defects: stooq now serves a JS proof-of-work challenge, and Yahoo `v7/finance/quote` is crumb-gated and 401s. Only `v8/finance/chart` works. |
| `CLAUDE-CODE-PROMPTS.md` | Setup, the phase prompt template, usage-saving notes. |
| `REDESIGN_PROMPT.md` | **Superseded and misleading.** It ran already; its diagnosis is code hygiene only. Do not follow its screen briefs. |
| `.claude/skills/` | 30 project-scoped skills. See below. |

---

## 6. Skills

Project-scoped in `.claude/skills/`, so they load only in this repo. Thirty is
too many — every description loads into every session. Name only the three to
five a session needs.

Custom ones written for this project:

- **`sw-release`** — the two service-worker rules that silently break installed
  clients: bump `V` in `sw.js` on any css/js edit, and register new files in
  `CORE`. Invoke on every session that touches css or js.
- **`token-discipline`** — economical context use; blocks known context sinks.
- **`session-canary`** — every response opens `Hey Isaac — Investing-app · <task>`.
  If that line changes or the name comes out wrong, context has been compacted
  and the session should be cleared. It is a context-drift detector, **not** a
  hallucination detector — the same file explains why, and pairs it with an
  evidence-marking convention that does address accuracy.

Third-party ones that matter: `lightweight-charts` (TradingView, first-party),
`modern-web-guidance` (Chrome + Edge teams), Trail of Bits security set
(`insecure-defaults`, `sharp-edges`, `differential-review`, `fp-check`),
`security-audit` (Cloudflare), plus the superpowers set
(`test-driven-development`, `verification-before-completion`,
`systematic-debugging`).

---

## 7. Where the project stands

**Live and pushed** (through commit `59fe191`, v9.7.5): the complete five-tab
rebuild, a maths fix, a Content Security Policy, and the vault audit fixes.

Done:
- **Phase 0** — Playwright suite plus a golden-master snapshot of every figure.
- **Phase 1** — every financial function tested against an independent Python
  oracle. Found a real bug: `riskStats()` annualised weekly-sampled data with
  `sqrt(252)`, overstating volatility 2.2× and annualised return 4.8×.
- **Phase 2** — hero chart ported from Chart.js to TradingView Lightweight
  Charts.
- **Phase 3** — View Transitions, motion pass, three UI fixes.
- **R1–R4** — the five-tab rebuild: Home, Markets, Portfolio, Insights,
  Following. Explore was split into Markets and Following.
- **Phase 5** — vault audit on Opus. Three true positives after the audit
  retracted six of its own findings under `fp-check`. All fixed.
- **Phase 7 part 1** — 102 innerHTML sinks audited, zero unsafe.
- **Phase 7 part 2** — CSP added; three inline-handler footguns fixed at the
  cause rather than widened away.
- Daily Movers bar chart, logo/chart/segmented-control bug fixes.

**Uncommitted right now:** several sessions of work — the movers chart, the
three bug fixes, and the small items with them. Get this committed early.

---

## 8. What is outstanding

**Immediate — a prompt was already written for this and may not have run yet:**
Price highlights, Portfolio insights tiles, restoring `#moverNarrative`, and
wiring `#screenSeg`.

**Then, in order:**

1. **Upcoming with earnings** (`DESIGN-TARGET.md` Home v2 §2). The only piece
   left with real unknowns. Yahoo's `quoteSummary` earnings module may be
   crumb-gated the way `v7/quote` is — the session must find a working free
   source, route it through the Worker, or ship dividends-only and say so.
   Set expectations: his portfolio is mostly ETFs, and **ETFs have no
   earnings**, so that section will be thin regardless of data quality.
2. **Phase 4 — quality floor.** Split into three sessions, not one:
   accessibility (axe, WCAG 2.2 AA), Core Web Vitals (baseline first, mid-tier
   mobile CPU throttling), and lazy-loading Chart.js. Both chart libraries
   currently ship on first load — a 28.8% page-weight increase from Phase 2 —
   and Chart.js is only needed once a sheet or the Insights tab opens.
3. **Phase 6 — Monte Carlo projection.** Empower's Retirement Planner pattern.
   Run it in a Web Worker.

**Isaac still owes himself two manual jobs:**
- **Rotate the cloud key.** His old export files and current `pt_bk` leaked a
  raw AES-256 cloud key and a passcode verifier (Phase 5 TP-1, now fixed in
  code). Order: Settings → Cloud backup OFF (deletes the Worker's record) →
  change passcode → Cloud backup ON → delete old export files → re-export.
  **Confirm he has a current backup before step one.**
- **Check his real data survived.** He deleted the expired native iOS app. A
  WKWebView has its own storage container, so if he was using the app rather
  than Safari, his vault went with it. The export/import round-trip is now
  tested, so restoring from a backup file is safe.

---

## 9. Traps — things that have already gone wrong

- **A control's active state hardcoded in markup and never cleared.** Happened
  three times: `aria-current` on the rail nav, `aria-selected` on both segmented
  controls. A second CSS rule paints an identical highlight, so two things look
  selected. `test/active-state.spec.js` now guards this — keep it covering every
  new control.
- **CSS `@layer` order.** `layout.css` sits in a later layer than
  `components.css`, so a rule there silently outranks one that looks more
  specific. This hid one bug completely.
- **A CSS selector that never matches fails silently.** `.blogo img` was wrong
  from the first redesign commit; `.blogo` is on the `<img>` itself. Logos
  rendered stacked on monograms for weeks.
- **Sessions reporting work verified when it was not.** The sheet-scroll bug
  survived three "verified" fixes. The root cause was a missing `min-height: 0`
  — a flex item will not shrink below its content, so no child can become a
  scroll container without it.
- **Browser automation is the wall-clock killer.** One session spent most of an
  hour in a stale-cache probing loop. Cap screenshots; prefer DOM measurement.
- **Never let a session read `repomix-output.xml`** (deleted, but it may
  regenerate) or `.claude/worktrees/`. Both are full duplicates of the repo.
- **Elements silently dropped during restructures.** `#homePr` and
  `#moverNarrative` have each been deleted more than once because a new
  composition "had no slot" for them. When a redesign session removes something,
  check whether it was relocated or just lost.

---

## 10. Tone

Be direct. Say when something is wrong, including when it is your own earlier
call — several specs written for this project turned out to be wrong and were
corrected by the sessions implementing them, which is the system working.
Do not congratulate. Do not hedge. He reads carefully and asks good questions,
and he will tell you plainly when an answer does not match what he is seeing —
when that happens, believe him over your own documentation.
