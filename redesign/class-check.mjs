// Every class the JS and HTML emit, checked against what the CSS defines.
//
//   node redesign/class-check.mjs
//
// This is the check that should have been written after the SECOND time a
// component rendered wrong. The redesign kept element ids intact so the JS never
// threw — which made every breakage silent: content written into containers that
// had no styling and therefore no size. Holdings rows, the goal ring, the
// allocation donut, movers, index tiles, the health card and the assistant panel
// were all the same defect, found one screenshot at a time instead of all at once.
import { readFileSync, readdirSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const css = ["tokens", "base", "components", "layout"]
  .map((f) => readFileSync(ROOT + "css/" + f + ".css", "utf8")).join("\n");
const defined = new Set([...css.matchAll(/\.([a-z][a-z0-9_-]*)/g)].map((m) => m[1]));

const src = readdirSync(ROOT + "js").filter((f) => f.endsWith(".js"))
  .map((f) => readFileSync(ROOT + "js/" + f, "utf8")).join("\n")
  + readFileSync(ROOT + "index.html", "utf8");

const emitted = new Set();
for (const m of src.matchAll(/class="([^"$`]*)"/g))
  for (const c of m[1].split(/\s+/)) if (/^[a-z][a-z0-9-]+$/.test(c)) emitted.add(c);

const undef = [...emitted].filter((c) => !defined.has(c)).sort();
console.log(`emitted ${emitted.size}   undefined ${undef.length}`);
if (undef.length) console.log(undef.join(" "));
process.exit(undef.length ? 1 : 0);
