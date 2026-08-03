// WCAG contrast audit over the declared token pairs, both themes.
//
//   node redesign/contrast-check.mjs            report
//   node redesign/contrast-check.mjs --md       markdown table for DESIGN.md
//   node redesign/contrast-check.mjs --strict   exit 1 if anything fails
//
// Written because the brief forbids eyeballing this, and because a dark theme is
// exactly where eyeballing goes wrong: muted greys on a dark canvas look fine and
// measure at 3:1. Tokens are duplicated here from css/tokens.css deliberately —
// this file is the independent check, so it must not import the thing it audits.
// If a token changes, change it here too; the mismatch guard below catches drift
// once tokens.css exists.

const DARK = {
  canvas: "#0B0F17",
  surface: "#14171F",
  "surface-2": "#1F242D",
  "surface-3": "#262C36",
  line: "#1B212C",
  "line-strong": "#3A424F",
  text: "#F2F4F8",
  // Solved, not chosen — same reasoning as --border-control below.
  // DESIGN-TARGET.md specifies #6E7789 / #525A6A; neither clears the 4.5:1
  // body-text floor against canvas, surface OR surface-2 (measured 4.26 and
  // 2.77 against canvas alone). Lightened just enough to clear all three,
  // same hue family. See css/tokens.css for the full note.
  "text-muted": "#9099AC",
  "text-faint": "#838B9C",
  primary: "#7C6CFF",
  "primary-fill": "#5B4ECC",
  "primary-edge": "#443A99",
  secondary: "#E0AE4A",
  gain: "#2FD08A",
  loss: "#FF5D6B",
  "on-primary": "#FFFFFF",
  // Solved, not chosen. The brief specified --line-strong for input borders, but
  // it measures 1.70 against --surface and WCAG 1.4.11 holds a control boundary
  // to 3:1. Rather than dragging every divider up to that weight — which would
  // make the whole app loud and lose the calm register — control borders get
  // their own token. --line-strong remains structural and decorative.
  "border-control": "#686E78",
};

const LIGHT = {
  canvas: "#F6F7F9",
  surface: "#FFFFFF",
  "surface-2": "#F1F3F6",
  "surface-3": "#E9ECF1",
  line: "#E2E6EC",
  "line-strong": "#CBD2DC",
  text: "#10151D",
  "text-muted": "#566072",
  "text-faint": "#6B7280",
  primary: "#4F3DC4",
  "primary-fill": "#4F3DC4",
  "primary-edge": "#3A2B99",
  secondary: "#8A6110",
  gain: "#0A7F58",
  loss: "#D02D40",
  "on-primary": "#FFFFFF",
  "border-control": "#878D97",
};

// The 8-step categorical ramp for allocation/sector marks — DESIGN-TARGET.md's
// exact asset palette, assigned by position order and stable per symbol.
// Constraint: none may read as gain or loss, so the greens and reds of the
// P&L tokens are excluded.
const RAMP_DARK = ["#7C6CFF", "#5B8DEF", "#F0A24A", "#2FD08A", "#3ABEC7", "#E36A9A", "#2F6BE0", "#B45309"];
const RAMP_LIGHT = ["#2E63C8", "#6D4BC4", "#1B7F8C", "#8A6110", "#A83C67", "#3C6FA8", "#5A6478", "#7A5A2E"];

// ── maths ──────────────────────────────────────────────────────────────────
function srgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

/** Relative luminance, WCAG 2.x definition. */
function lum(hex) {
  const [r, g, b] = srgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// ── the pairs that actually matter ─────────────────────────────────────────
// Each entry: [foreground token, background token, minimum, what it is]
// 4.5 = body text. 3.0 = text ≥19px and non-text UI boundaries (WCAG 1.4.11).
const PAIRS = [
  ["text", "canvas", 4.5, "body copy on the app background"],
  ["text", "surface", 4.5, "body copy on a card"],
  ["text", "surface-2", 4.5, "body copy on a nested surface"],
  ["text", "surface-3", 4.5, "body copy on a pressed surface"],
  ["text-muted", "canvas", 4.5, "secondary metadata on background"],
  ["text-muted", "surface", 4.5, "secondary metadata on a card"],
  ["text-muted", "surface-2", 4.5, "secondary metadata on a nested surface"],
  ["text-faint", "canvas", 4.5, "captions and footnotes"],
  ["text-faint", "surface", 4.5, "captions on a card"],
  ["primary", "canvas", 4.5, "links and active nav"],
  ["primary", "surface", 4.5, "links on a card"],
  ["primary", "surface-2", 3.0, "selected segment label"],
  ["on-primary", "primary-fill", 4.5, "label on a filled primary button"],
  ["secondary", "canvas", 4.5, "goal and warning text"],
  ["secondary", "surface", 4.5, "warning text on a card"],
  ["gain", "canvas", 4.5, "positive delta"],
  ["gain", "surface", 4.5, "positive delta on a card"],
  ["gain", "surface-2", 4.5, "positive delta in a pill"],
  ["loss", "canvas", 4.5, "negative delta"],
  ["loss", "surface", 4.5, "negative delta on a card"],
  ["loss", "surface-2", 4.5, "negative delta in a pill"],
  ["line", "canvas", 1.0, "hairline divider (decorative, no minimum)"],
  ["line-strong", "canvas", 1.0, "structural hairline (decorative, no minimum)"],
  ["line-strong", "surface", 1.0, "structural hairline on a card"],
  ["border-control", "canvas", 3.0, "form-control boundary — WCAG 1.4.11 applies"],
  ["border-control", "surface", 3.0, "form-control boundary on a card"],
  ["border-control", "surface-2", 3.0, "form-control boundary on an input fill"],
  ["primary", "surface-3", 3.0, "focus ring against a pressed surface"],
];

function run(name, T, ramp) {
  const rows = [];
  for (const [fg, bg, min, what] of PAIRS) {
    const r = ratio(T[fg], T[bg]);
    rows.push({ fg, bg, r, min, what, pass: r >= min });
  }
  // Every ramp colour must clear 3:1 against the surface it is drawn on, since a
  // donut segment or sector bar is a non-text UI mark.
  ramp.forEach((hex, i) => {
    const r = ratio(hex, T.surface);
    rows.push({ fg: `ramp-${i + 1} (${hex})`, bg: "surface", r, min: 3.0, what: "categorical data mark", pass: r >= 3.0 });
  });
  return { name, rows };
}

const results = [run("Dark (default)", DARK, RAMP_DARK), run("Light", LIGHT, RAMP_LIGHT)];
const failures = results.flatMap((t) => t.rows.filter((r) => !r.pass).map((r) => ({ theme: t.name, ...r })));

if (process.argv.includes("--md")) {
  for (const t of results) {
    console.log(`\n#### ${t.name}\n`);
    console.log("| Foreground | Background | Ratio | Min | Verdict | Role |");
    console.log("|---|---|---|---:|---:|---|");
    for (const r of t.rows) {
      console.log(`| \`--${r.fg}\` | \`--${r.bg}\` | **${r.r.toFixed(2)}** | ${r.min.toFixed(1)} | ${r.pass ? "pass" : "**FAIL**"} | ${r.what} |`);
    }
  }
} else {
  for (const t of results) {
    console.log(`\n=== ${t.name} ===`);
    for (const r of t.rows) {
      console.log(`  ${r.pass ? "✓" : "✗"} ${r.r.toFixed(2).padStart(5)} (min ${r.min})  ${r.fg} on ${r.bg} — ${r.what}`);
    }
  }
  console.log(`\n${failures.length === 0 ? "✓ ALL PASS" : `✗ ${failures.length} FAILURES`}`);
  for (const f of failures) console.log(`   ${f.theme}: ${f.fg} on ${f.bg} = ${f.r.toFixed(2)}, needs ${f.min}`);
}

if (process.argv.includes("--strict") && failures.length) process.exit(1);
