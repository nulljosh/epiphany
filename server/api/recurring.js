// Recurring bills and paydays found in statement transactions. Split from statements-shared.js.
import { normalizeMerchant, MIN_MERCHANT_KEY_LENGTH, isMoneyIn } from './statements-shared.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 3600 * 1000;
const CADENCES = [
  { name: 'biweekly', min: 12, max: 16, days: 14, perMonth: 2.6 },
  { name: 'monthly', min: 26, max: 35, days: 30, perMonth: 1.5 },
  { name: 'yearly', min: 350, max: 380, days: 365, perMonth: 1.1 },
];
// Bills by default; `income: true` finds paydays the same way (money in that repeats on a cadence).
// `stopped: true` returns the bills that missed two cycles instead (cancelled subscriptions).
export function detectRecurring(transactions = [], today = new Date(), { income = false, stopped = false } = {}) {
  const groups = new Map();
  for (const txn of transactions) {
    const side = income ? txn?.amount > 0 && isMoneyIn(txn) : txn?.amount < 0;
    if (!side || !DATE_RE.test(txn?.date || '')) continue;
    // Banks rename the same biller ("PRE AUTHORIZED DEBIT TO ABC CLUB", "ABC CLUB
    // FITNESS"), so recurring matching drops the bank prefix and keeps two words.
    const key = normalizeMerchant(txn.description)
      .replace(/^(pre ?authorized debit( to)?|pad( to)?|pos purchase|purchase)\s+/, '')
      .split(' ').slice(0, 2).join(' ');
    // Money moved between your own accounts or to people is not a bill.
    if (key.length < MIN_MERCHANT_KEY_LENGTH || /^(transfer|e transfer|interac|withdrawal|atm)\b/.test(key)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(txn);
  }

  // Judge "stopped" against the newest statement, not the clock: months without an
  // upload should not make every subscription look cancelled.
  const newest = Math.max(...[...groups.values()].flat().map((t) => Date.parse(`${t.date}T00:00:00Z`)));
  const ref = Math.min(today.getTime(), newest);
  const out = [];
  for (const [key, all] of groups) {
    const bands = [];
    for (const txn of [...all].sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount))) {
      const band = bands[bands.length - 1];
      if (band && Math.abs(txn.amount) <= Math.abs(band[0].amount) * 1.15) band.push(txn);
      else bands.push([txn]);
    }
    for (const band of bands) {
      const txns = band.sort((a, b) => a.date.localeCompare(b.date));
      const months = new Set(txns.map((t) => t.date.slice(0, 7))).size;
      if (months < 2) continue;
      const times = txns.map((t) => Date.parse(`${t.date}T00:00:00Z`));
      const gaps = times.slice(1).map((t, i) => (t - times[i]) / DAY_MS).sort((a, b) => a - b);
      const gap = gaps[Math.floor(gaps.length / 2)];
      const cadence = CADENCES.find((c) => gap >= c.min && gap <= c.max);
      // The rate check is what keeps a daily coffee out.
      if (!cadence || txns.length / months > cadence.perMonth) continue;
      const last = txns[txns.length - 1];
      const next = new Date(times[times.length - 1] + cadence.days * DAY_MS);
      // Two missed cycles: probably cancelled.
      if ((ref - next > cadence.days * 1.2 * DAY_MS) !== stopped) continue;
      const amount = Math.abs(last.amount);
      const prev = Math.abs(txns[txns.length - 2].amount);
      out.push({
        merchant: key,
        name: last.description,
        amount,
        cadence: cadence.name,
        lastDate: last.date,
        nextDate: next.toISOString().slice(0, 10),
        priceDelta: Math.round((amount - prev) * 100) / 100,
        count: txns.length,
        months: [...new Set(txns.map((t) => t.date.slice(0, 7)))].sort(),
      });
    }
  }
  return out.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}
