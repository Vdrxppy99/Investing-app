# Redesign — final state

Branch `redesign`, 7 commits. **Not pushed**, so GitHub Pages and the native
Portfolio app on the phone still serve the old build until you merge.

## To look at it

```bash
cd ~/Claude/Projects/Investing-app && python3 -m http.server 8080
```

`http://127.0.0.1:8080/index.html` → tap **See an example portfolio**.
`http://127.0.0.1:8080/dev/components.html` → the component gallery.

**Caching gotcha:** the browser holds `js/*.js` and `css/*.css` in memory cache
hard. If an edit seems not to apply, serve on a different port rather than
reloading. This cost me several cycles.

## Purity — all pass

| Check | Result |
|---|---|
| inline `style=` in index.html | **0** (was 40) |
| emoji as icons | **0** (was 13 distinct, 36 uses) |
| colour literals outside `tokens.css` | **0** (was 48) |
| font-size literals outside `tokens.css` | **0** (was 25 sizes, 8 half-pixel) |
| durations outside the token set | **0** |
| live `prompt` / `confirm` / `alert` | **0** (was 10) |
| `css/app.css` | deleted |
| CDN references | **0** — Chart.js vendored |
| JS files parsing | 8 / 8 |

## What is NOT done

**1. Inline styles emitted from JS: ~120 remain.** `index.html` is clean, and the
classes those sites emit are now defined in tokens, so the app is coherent — but
the emission sites still write `style="…"` strings. Removing them means rewriting
25 `innerHTML` sites in `portfolio.js` and similar in `insights.js`/`sheets.js`.
That is the largest remaining piece of the brief.

**2. The numbers diff is inconclusive, and I will not claim otherwise.**
Baseline was 126 / 16 / 232 tokens (portfolio / markets / insights); after is
104 / 0 / 216. The differences have plausible innocent causes:

- the demo fixture is rebuilt per session and contains date- and time-dependent
  values, so two captures are never byte-identical
- `markets` needs live network fetches that did not complete in this environment
  (it was already only 16 tokens at baseline for the same reason)
- the redesign **legitimately removes duplicate displays** of the same number —
  the audit found `$146,984.16` rendered 3× and `$357.67` 3× on Portfolio alone,
  because four stacked boxes each showed a slice of the same total. Consolidating
  them into one hero removes repeats without changing a calculation.

What I did verify: every render function runs with **no console errors**, the
total, day delta, all 6 holdings, the goal and the chart all render, and no
arithmetic, storage key, API call or crypto path was touched. But that is not the
same as proving the diff is empty, and the brief asked for the diff. **Re-run it
against your real data before merging.**

**3. Not done:** Lighthouse, the 44px-target script, the reduced-motion test, the
60fps profile, a real offline cold-start test, and the on-device pass in the
`native/` wrapper. `redesign/NATIVE-CHECKLIST.md` was never produced.

**4. Light theme** is implemented and passes contrast on paper but was only
spot-checked in the gallery, not swept across all three rebuilt screens.

## Phase 3 security invariants — confirmed

Crypto is byte-identical: `kekFromPass`, `kekFromPrf`, `wrapMK`, `unwrapMK`,
`saveVaultNow`, `loadVaultData`, `doSetup`, PBKDF2 iterations, HKDF parameters,
PRF salt handling, and the keys `pt_v_pass` / `pt_v_prf` / `pt_vault_data`.
The passcode wrap remains the recovery path; the passcode is never stored; the
master key lives only in memory; the demo passcode never derives a real key;
`enrollFace` still requires `userVerification: 'required'`.
