// Dev server that refuses to be cached.
//
//   node redesign/serve.mjs [port]      default 8080, bound to 0.0.0.0
//
// python3 -m http.server sends Last-Modified, and both Safari and the in-app
// browser then hold js/ and css/ in memory cache across reloads. During this
// redesign that produced a string of phantom bugs — edits that appeared not to
// apply, and a lock screen whose buttons were inert because the page was running
// a previous version of vault.js. The workaround was a new port per change,
// which is untenable when testing on a phone.
//
// Cache-Control: no-store on everything. Reload always means reload.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, normalize } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const PORT = Number(process.argv[2] || 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

createServer((req, res) => {
  let path = decodeURIComponent((req.url || "/").split("?")[0]);
  if (path.endsWith("/")) path += "index.html";
  const file = join(ROOT, normalize(path));

  // Never serve outside the project, whatever the request asks for.
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain", "cache-control": "no-store" });
    return res.end("not found");
  }

  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-store, no-cache, must-revalidate",
    pragma: "no-cache",
    expires: "0",
  });
  res.end(readFileSync(file));
}).listen(PORT, "0.0.0.0", () => {
  console.log(`serving ${ROOT}`);
  console.log(`  local  http://127.0.0.1:${PORT}/index.html`);
  console.log(`  phone  http://192.168.0.100:${PORT}/index.html`);
  console.log("  no-store on everything — a reload is always a real reload");
});
