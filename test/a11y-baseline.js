'use strict';
/* One-off script (not part of the suite) to produce a clean before/after axe
   summary: per-surface violation counts by impact, and total unique rule ids.
   Run: node test/a11y-baseline.js [--out FILE] */
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

const PORT = 4174;
const outArg = process.argv.indexOf('--out');
const OUT = outArg !== -1 ? process.argv[outArg + 1] : null;

async function main() {
  const server = spawn('node', ['test/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 600));

  const browser = await chromium.launch();
  const surfaces = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.addInitScript((t) => {
      Date.now = () => t;
      Date = class extends Date {
        constructor(...args) { super(...(args.length ? args : [t])); }
        static now() { return t; }
      };
    }, FROZEN_TIME);
    await blockExternalNetwork(page);
    page.goto = ((orig) => (url, opts) => orig.call(page, `http://localhost:${PORT}${url}`, opts))(page.goto.bind(page));
    await unlockDemo(page);

    const tabs = ['home', 'markets', 'portfolio', 'insights', 'following'];
    for (const tab of tabs) {
      await page.locator(`.tabbar__item[data-page="${tab}"]`).click();
      await page.waitForTimeout(300);
      const results = await new AxeBuilder({ page }).analyze();
      surfaces.push({ surface: `${tab} tab`, violations: results.violations });
    }

    await page.locator('.tabbar__item[data-page="portfolio"]').click();
    await page.waitForTimeout(300);
    await page.locator('.hrow').first().click();
    await page.waitForTimeout(400);
    const detail = await new AxeBuilder({ page }).analyze();
    surfaces.push({ surface: 'holding detail sheet', violations: detail.violations });

    let totalNodes = 0;
    const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    const ruleIds = new Set();
    for (const s of surfaces) {
      let sNodes = 0;
      for (const v of s.violations) {
        ruleIds.add(v.id);
        byImpact[v.impact] = (byImpact[v.impact] || 0) + v.nodes.length;
        sNodes += v.nodes.length;
        totalNodes += v.nodes.length;
      }
      console.log(`${s.surface}: ${s.violations.length} rules, ${sNodes} nodes`);
      for (const v of s.violations) {
        console.log(`  [${v.impact}] ${v.id} (${v.nodes.length}) — ${v.help}`);
      }
    }
    console.log('---');
    console.log(`TOTAL: ${totalNodes} violating nodes across ${ruleIds.size} unique rules`);
    console.log('By impact:', byImpact);

    if (OUT) fs.writeFileSync(OUT, JSON.stringify({ surfaces, totalNodes, byImpact, ruleIds: [...ruleIds] }, null, 2));
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
