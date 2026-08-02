'use strict';
/* Regenerates test/golden/golden-master.json from a live run of the demo dataset.
   Run this ONLY when a change to core.js/insights.js math is deliberate and you've
   confirmed the new numbers are correct — never to make a failing diff pass.
   Usage: node test/server.js & then PORT=4173 node test/golden/capture.js */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo, collectFigures } = require('../helpers');

const PORT = process.env.PORT || 4173;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: `http://localhost:${PORT}` });
  const page = await context.newPage();
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
  page.setDefaultTimeout(15000);
  await unlockDemo(page);
  const figures = await collectFigures(page);
  const out = {
    _comment: 'Captured with the clock frozen at test/helpers.js FROZEN_TIME (2026-08-01T23:45:43.103Z), demo passcode dataset (js/demo.js). Regenerate with `npm run test:golden:capture` only when a change to core.js/insights.js math is deliberate — never to make a failing diff pass.',
    ...figures,
  };
  fs.writeFileSync(path.join(__dirname, 'golden-master.json'), JSON.stringify(out, null, 2) + '\n');
  console.log('golden-master.json updated');
  await browser.close();
})();
