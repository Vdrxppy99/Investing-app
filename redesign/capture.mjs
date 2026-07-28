// Screenshot + DOM capture harness for the redesign.
//
//   node redesign/capture.mjs before      → redesign/before/*.png  + baseline-numbers.txt
//   node redesign/capture.mjs after       → redesign/after/*.png   + after-numbers.txt
//
// Works by copying the app to a scratch directory and injecting a shim THERE that
// reads ?shot=<page>&theme=<t>, enters demo mode and switches tab automatically.
// The real app is never modified — Phase 0 has to stay read-only, and even later
// the app must not carry screenshot scaffolding.
//
// Chrome headless is driven by CLI only (no npm, no puppeteer — the brief forbids
// adding a build step or dependencies), so each shot is its own process.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:http";
import { extname } from "node:path";

const MODE = process.argv[2] === "after" ? "after" : "before";
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const WORK = "/tmp/pt-capture";
const OUT = join(ROOT, "redesign", MODE);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8931;

const PAGES = ["portfolio", "markets", "insights"];
const THEMES = ["dark", "light"];
const WIDTHS = MODE === "before" ? [375, 1280] : [375, 768, 1280, 1600];

// ── 1. scratch copy with the shim ──────────────────────────────────────────
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
for (const p of ["index.html", "js", "css", "sw.js", "manifest.webmanifest"]) {
  if (existsSync(join(ROOT, p))) cpSync(join(ROOT, p), join(WORK, p), { recursive: true });
}

const SHIM = `
<script>
// Injected by redesign/capture.mjs into a COPY of the app. Never shipped.
(function () {
  var q = new URLSearchParams(location.search);
  var page = q.get('shot'), theme = q.get('theme') || 'dark';
  if (!page) return;
  document.documentElement.dataset.theme = theme;
  window.__shotReady = false;
  window.addEventListener('load', function () {
    // Demo mode lazily loads the app scripts, so poll for showPage to exist.
    try { window.enterDemo && window.enterDemo(); } catch (e) {}
    var tries = 0;
    var t = setInterval(function () {
      if (typeof window.showPage === 'function') {
        clearInterval(t);
        try { window.showPage(page); } catch (e) {}
        document.documentElement.dataset.theme = theme;
        // Give charts a beat to draw before declaring the page settled.
        setTimeout(function () { window.__shotReady = true; document.title = 'READY'; }, 1200);
      } else if (++tries > 120) { clearInterval(t); window.__shotReady = true; document.title = 'READY'; }
    }, 50);
  });
})();
</script>
`;
const html = readFileSync(join(WORK, "index.html"), "utf8");
writeFileSync(join(WORK, "index.html"), html.replace("</body>", SHIM + "</body>"));

// ── 2. static server ───────────────────────────────────────────────────────
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/json", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split("?")[0]);
  const file = join(WORK, path === "/" ? "index.html" : path);
  if (!file.startsWith(WORK) || !existsSync(file)) { res.writeHead(404); return res.end("nope"); }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

// ── 3. capture ─────────────────────────────────────────────────────────────
// Screenshots are opt-in. The owner knows what the app looks like and asked not
// to spend time on a before/after sweep; the numbers capture below is the part
// the preservation contract actually depends on, so it always runs.
const SHOTS = process.argv.includes("--shots");
mkdirSync(OUT, { recursive: true });
const shots = [];
for (const w of SHOTS ? WIDTHS : []) {
  for (const theme of THEMES) {
    for (const page of PAGES) {
      const name = `${page}-${theme}-${w}.png`;
      execFileSync(CHROME, [
        "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-sandbox",
        `--window-size=${w},1400`,
        `--screenshot=${join(OUT, name)}`,
        "--virtual-time-budget=6000",
        `http://127.0.0.1:${PORT}/?shot=${page}&theme=${theme}`,
      ], { stdio: "ignore" });
      shots.push(name);
      process.stdout.write(".");
    }
  }
}
console.log(`\n✓ ${shots.length} screenshots → redesign/${MODE}/`);

// ── 4. every rendered number, for the preservation diff ────────────────────
// The contract is that no displayed number may change. Capturing the rendered
// text (not the source) is the only way to prove that.
const numbers = [];
for (const page of PAGES) {
  const dom = execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--dump-dom",
    "--virtual-time-budget=6000",
    `http://127.0.0.1:${PORT}/?shot=${page}&theme=dark`,
  ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

  // Strip tags/scripts/styles, then keep any token containing a digit. Sorted so
  // that a pure reordering of the DOM does not read as a data change.
  const text = dom
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ");
  const found = (text.match(/[$€£]?-?[0-9][0-9,.]*%?/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => /[0-9]/.test(s));
  numbers.push(`# ${page} — ${found.length} numeric tokens`);
  numbers.push(...found.sort());
}
const numFile = join(ROOT, "redesign", MODE === "before" ? "baseline-numbers.txt" : "after-numbers.txt");
writeFileSync(numFile, numbers.join("\n") + "\n");
console.log(`✓ ${numbers.length} lines → ${numFile.replace(ROOT + "/", "")}`);

server.close();
rmSync(WORK, { recursive: true, force: true });
