'use strict';
/* Regression guard for css/tokens.css's --cat-1..6 categorical ramp. Reads the
 * LIVE computed values (not a hardcoded copy) in both themes and runs them
 * through the same validator used to derive the palette
 * (.claude/skills/dataviz/scripts/validate_palette.js), against this app's
 * own surfaces. Fails if a future edit reintroduces a colliding pair — see
 * the tokens.css comment above --cat-1 for how the current six were derived. */
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('node:url');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

const CAT_SLOTS = ['--cat-1', '--cat-2', '--cat-3', '--cat-4', '--cat-5', '--cat-6'];
const SURFACE = { dark: '#0B0F17', light: '#FBFBFC' };
const VALIDATOR_PATH = path.join(__dirname, '..', '.claude/skills/dataviz/scripts/validate_palette.js');

async function readCatTokens(page, theme) {
  await page.addInitScript((t) => { try { localStorage.setItem('pt_theme', JSON.stringify(t)); } catch (e) {} }, theme);
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
  await unlockDemo(page);
  return page.evaluate((slots) => {
    const cs = getComputedStyle(document.documentElement);
    return slots.map((s) => cs.getPropertyValue(s).trim());
  }, CAT_SLOTS);
}

for (const theme of /** @type {const} */ (['dark', 'light'])) {
  test(`--cat-1..6 pass validate_palette.js in ${theme} mode`, async ({ page }) => {
    const hexes = await readCatTokens(page, theme);
    expect(hexes).toHaveLength(6);
    for (const h of hexes) expect(h).toMatch(/^#[0-9a-fA-F]{6}$/);

    const { validate } = await import(pathToFileURL(VALIDATOR_PATH).href);
    const { report, ok } = validate(hexes, { mode: theme, surface: SURFACE[theme] });
    const failing = report.filter(([, state]) => state === false || state === 'fail');
    expect(failing, failing.map(([name, , detail]) => `${name}: ${detail}`).join('\n')).toHaveLength(0);
    expect(ok).toBe(true);
  });
}
