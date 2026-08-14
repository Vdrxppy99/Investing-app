'use strict';
/* Unit coverage for t() (js/i18n.js), the render-site translator session 1 introduced
   for template literals. Session 1 claimed it was "unit-proven" but no test actually
   existed — this session's brief required confirming, before wiring t() into any real
   sentence, that a German translation can place its interpolated values in a DIFFERENT
   ORDER than the English source uses (German clause order routinely differs from
   English). The original implementation joined the template's static segments on a
   bare "%s" and reinserted `values[i]` at the i-th "%s" of WHICHEVER template ended up
   being used (English or German) — purely positional, by array index. A German
   translation that needed its first value to be the English sentence's SECOND
   interpolated value had no way to say so: t() would always hand it values[0] first,
   values[1] second, in original call order, regardless of what the German prose meant
   at that position. Fixed by numbering placeholders (%1, %2, …) in the derived key, so
   the dictionary VALUE can reference any value by its number, in any order, repeated or
   not — not by the position it happens to be split into. */
const { test, expect } = require('@playwright/test');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
});

test('t() reassembles the original English when no DE entry exists', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('pt_lang', 'en'); } catch (e) {} });
  await unlockDemo(page);
  const out = await page.evaluate(() => {
    const A = 'Alpha', B = 'Bravo';
    return t`${A} comes before ${B} in the alphabet`;
  });
  expect(out).toBe('Alpha comes before Bravo in the alphabet');
});

test('t() substitutes correctly when German uses the SAME order as English', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('pt_lang', 'de'); } catch (e) {} });
  await unlockDemo(page);
  const out = await page.evaluate(() => {
    window.i18nDE['%1 comes before %2 in the alphabet'] = '%1 kommt vor %2 im Alphabet';
    const A = 'Alpha', B = 'Bravo';
    return t`${A} comes before ${B} in the alphabet`;
  });
  expect(out).toBe('Alpha kommt vor Bravo im Alphabet');
});

test('t() lets a German translation place interpolated values in a DIFFERENT order than English', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('pt_lang', 'de'); } catch (e) {} });
  await unlockDemo(page);
  const out = await page.evaluate(() => {
    // English clause order: "<lot> turns long-term in <days>d" (value order: lot, days).
    // Natural German puts the time span first: "In <days> Tagen wird <lot> langfristig"
    // — the SAME two values, reversed. %1/%2 in the DE value are numbered references to
    // the ORIGINAL call's values, not textual/positional slots, so this must be possible
    // without changing which value was passed first.
    window.i18nDE['%1 turns long-term in %2d'] = 'In %2 Tagen wird %1 langfristig';
    const lot = 'VOO', days = 14;
    return t`${lot} turns long-term in ${days}d`;
  });
  expect(out).toBe('In 14 Tagen wird VOO langfristig');
});

test('t() lets German reference the same interpolated value more than once', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('pt_lang', 'de'); } catch (e) {} });
  await unlockDemo(page);
  const out = await page.evaluate(() => {
    // English interpolates the ticker once; the DE value references %1 twice — only
    // possible because substitution keys off the NUMBER, not how many "%s" slots the
    // template happened to split into.
    window.i18nDE['%1 is a winner'] = '%1 ist ein Gewinner — ja, %1!';
    return t`${'VOO'} is a winner`;
  });
  expect(out).toBe('VOO ist ein Gewinner — ja, VOO!');
});
