/* shared helpers for the portfolio-push worker — time, money text, allowed origins.
   Single home for these so index.js (reports), alerts.js (movers) and quotes.js (proxy)
   can't drift apart. */

/* mirror of US_MARKET_HOLIDAYS in the app's js/portfolio.js — keep the two in sync */
export const HOLIDAYS = new Set([
  '2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
  '2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24'
]);

/* the only origins the API serves — the deployed PWA and the local preview */
export const ORIGINS = ['https://vdrxppy99.github.io', 'http://localhost:8937'];

export const money = v => '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const signed = v => (v >= 0 ? '+' : '-') + money(v);
export const pctS = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

export function etNow() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date());
  const g = t => { const x = parts.find(p => p.type === t); return x ? x.value : ''; };
  return { date: `${g('year')}-${g('month')}-${g('day')}`, hm: parseInt(g('hour'), 10) * 60 + parseInt(g('minute'), 10), wd: g('weekday') };
}
export const tradingDay = et => et.wd !== 'Sat' && et.wd !== 'Sun' && !HOLIDAYS.has(et.date);
