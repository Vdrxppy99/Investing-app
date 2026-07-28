# Redesign — the fix list

Owner verdict after seeing it on device: **"I like the new one, it just needs some
improvement. The foundation was good."** So the direction is right; these are the
specific things that were wrong.

`main` currently runs v3.2.1 (the pre-redesign app + Face ID-first unlock).
The redesign lives on **`redesign-wip`**. Restore it with:

```bash
git checkout main && git revert --no-edit 1affc78   # un-revert the revert
```

Do NOT do that until the two structural items below are fixed — they are broken,
not merely unpolished.

## Structural — must fix before any redeploy

**1. Holdings rows (worst problem).** Fund names wrap one word per line and logo
tiles stretch tall. Root cause: `css/components.css` defines `.hrow` / `.hmid` /
`.hsym` / `.blogo` by *guessing* their anatomy from their names. Two guesses are
provably wrong:
- `core.js:116` puts `.blogo` **directly on an `<img>`**, not on a wrapper, so the
  container styling (`display:grid`, fixed 40×40 with a nested `img{width:100%}`)
  stretches it.
- `.hmid` is not the flex column that was assumed, so the name gets a ~100px box.

Fix by **reading `renderList()` in `js/portfolio.js`** and rebuilding that row's
markup through `ui.row()`, rather than styling the class names it happens to emit.

**2. Goal ring.** Renders as a misshapen circle. `.ring` is a **name collision**:
`renderGoal()` emits its own `.ring` / `.rc` / `.rp` / `.rt` structure via
`ringSvg()`, and `components.css` defines an unrelated `.ring` component. Rename
one of them.

## Regressions I introduced by choice — revert the decision

**3. Explore rails.** Indices and sectors were fully visible at a glance; I made
them horizontal scrollers. Put them back to a wrapping grid — the density was the
point.

**4. Collapsible sections.** Owner has said twice: remove them. Delete the
`.group2` `<details>` pattern from Insights and the side modules entirely; use
plain always-visible cards. Keep the `.note` pattern for *prose* only.

**5. Insights organisation.** Judged worse than the old version. The old layout
had `.igrid` + `.icard` with eyebrow headings, which read as organised. Re-do the
grouping without hiding anything.

## Polish

**6. Appbar greeting truncates** to "Good nig…". `app.js:275` writes a greeting
plus date into the h1 next to five icon buttons. Either shorten what it writes,
drop the icons to a menu, or put the greeting on its own line above the hero.

**7. Hero sub-chips** ("Total profit ? +$7,389.77", "Deposited ?", "Return / yr ?")
read as raw text with stray `?` glyphs — those are info affordances rendering as
literal question marks. Make them real `ui.stat()` tiles or proper icon buttons.

**8. Icon buttons** have a visible box behind them the owner dislikes; and some
glyphs are wrong. Check the hand-written Lucide paths in `js/icons.js` against the
real set — `wallet` and `activity` in particular.

## What is sound and should not be touched

- `css/tokens.css` — 33 contrast pairs measured, both themes, all pass
- `css/base.css`, the 7-step type scale, tabular numerals
- `js/ui.js` builders, `dev/components.html` gallery
- `DESIGN.md`, `redesign/AUDIT.md`, `redesign/contrast-check.mjs`
- Chart.js vendored (the app could not chart offline before)
- Face ID-first unlock — **already shipped separately on main**
- The lock screen and the hero total: the two things built WITHOUT guessing at
  existing markup, and the two that came out right. That is the lesson.

## Method for next time

One screen at a time. Read the render function, rebuild its markup through
`ui.js`, verify on the phone, then move on. Do not batch all three screens into
one push again.
