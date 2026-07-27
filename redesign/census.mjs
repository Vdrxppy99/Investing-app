// Phase 0 value census. Evidence for how unsystematic the current styling is.
//
// Scripted rather than transcribed because the whole point of the number is that
// it is countable: "21 distinct font sizes" is an argument, "lots of font sizes"
// is an opinion.
//
//   node redesign/census.mjs            human-readable report
//   node redesign/census.mjs --json     machine-readable
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const JS_FILES = readdirSync(join(ROOT, "js")).filter((f) => f.endsWith(".js")).map((f) => `js/${f}`);
const CSS = "css/app.css";
const HTML = "index.html";

// ── helpers ────────────────────────────────────────────────────────────────
function tally(text, re, transform = (m) => m[0]) {
  const out = new Map();
  for (const m of text.matchAll(re)) {
    const k = transform(m);
    if (k == null) continue;
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

const sortByCount = (map) => [...map].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

function linesOf(path, re) {
  const hits = [];
  read(path).split("\n").forEach((line, i) => {
    for (const m of line.matchAll(re)) hits.push({ line: i + 1, text: m[0].slice(0, 160) });
  });
  return hits;
}

// ── the census ─────────────────────────────────────────────────────────────
const css = read(CSS);
const html = read(HTML);
const allJs = JS_FILES.map((f) => ({ file: f, src: read(f) }));

const fontSizes = tally(css, /font-size:\s*([0-9.]+)px/g, (m) => parseFloat(m[1]));
const colours = tally(css, /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g, (m) => m[0].toLowerCase());
const radii = tally(css, /border-radius:\s*([0-9.]+)px/g, (m) => parseFloat(m[1]));
const shadows = tally(css, /box-shadow:\s*([^;}]+)/g, (m) => m[1].trim().slice(0, 70));

// Padding/margin/gap shorthand can hold several values; count each separately.
const spacing = new Map();
for (const m of css.matchAll(/(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)?:\s*([^;}]+)/g)) {
  for (const v of m[1].matchAll(/([0-9.]+)px/g)) {
    const n = parseFloat(v[1]);
    spacing.set(n, (spacing.get(n) ?? 0) + 1);
  }
}

const inlineHtml = linesOf(HTML, /style="[^"]*"/g);
const inlineJs = allJs.flatMap(({ file }) => linesOf(file, /style="[^"]*"|style='[^']*'|\.style\.[a-zA-Z]+\s*=/g).map((h) => ({ ...h, file })));

// Emoji used as interface iconography. Explicit list beats a broad unicode range,
// which would also flag legitimate typography like the en dash.
const EMOJI = ["💬", "☁️", "👀", "➤", "✕", "☆", "★", "⚙︎", "⚙️", "▲", "▼", "🔒", "🔓", "📈", "📉", "💰", "🎯", "⚠️", "✅", "❌", "🔔", "🏦", "💵", "📊"];
const emojiHits = [];
for (const [label, src] of [[HTML, html], ...allJs.map((j) => [j.file, j.src])]) {
  src.split("\n").forEach((line, i) => {
    for (const e of EMOJI) if (line.includes(e)) emojiHits.push({ file: label, line: i + 1, emoji: e });
  });
}

// Half-pixel sizes are the specific tell that individual elements were nudged.
const halfPx = [...fontSizes.keys()].filter((n) => n % 1 !== 0).sort((a, b) => a - b);

const versionStamps = linesOf(CSS, /\/\*\s*v[0-9]+(\.[0-9]+)*[^*]*\*\//gi);

const report = {
  fontSizes: sortByCount(fontSizes),
  distinctFontSizes: fontSizes.size,
  halfPixelSizes: halfPx,
  colours: sortByCount(colours),
  distinctColours: colours.size,
  radii: sortByCount(radii),
  distinctRadii: radii.size,
  spacing: sortByCount(spacing),
  distinctSpacing: spacing.size,
  shadows: sortByCount(shadows),
  inlineStylesHtml: inlineHtml,
  inlineStylesJs: inlineJs,
  emoji: emojiHits,
  versionStamps,
  cssLines: css.split("\n").length,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const line = (s) => console.log(s);
  line(`CSS: ${report.cssLines} lines, ${report.versionStamps.length} version-stamped comment sections`);
  line(`\nFONT SIZES — ${report.distinctFontSizes} distinct`);
  line("  " + report.fontSizes.map(([v, c]) => `${v}px×${c}`).join("  "));
  line(`  half-pixel: ${report.halfPixelSizes.join(", ") || "none"}`);
  line(`\nCOLOURS — ${report.distinctColours} distinct literals`);
  line("  " + report.colours.slice(0, 22).map(([v, c]) => `${v}×${c}`).join("  "));
  line(`\nRADII — ${report.distinctRadii} distinct`);
  line("  " + report.radii.map(([v, c]) => `${v}px×${c}`).join("  "));
  line(`\nSPACING — ${report.distinctSpacing} distinct`);
  line("  " + report.spacing.map(([v, c]) => `${v}px×${c}`).join("  "));
  line(`\nSHADOWS — ${report.shadows.length} distinct`);
  line(`\nINLINE style= in index.html: ${report.inlineStylesHtml.length}`);
  line(`INLINE styles from JS: ${report.inlineStylesJs.length}`);
  line(`EMOJI as icons: ${report.emoji.length} occurrences (${new Set(report.emoji.map((e) => e.emoji)).size} distinct)`);
}
