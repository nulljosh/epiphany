// Price alerts with every app closed: a cron tick checks each untriggered alert against live
// quotes, flips the ones that crossed, then emails each owner once for everything that fired.
// ponytail: email, not APNs. Swap in push when an APNs key exists (#180).
import { sparkRequest, sparkConfigured } from './spark.js';
import { fetchYahooBatch } from './stocks-free.js';
import { sendEmail } from './_email.js';
import { verifyCronSecret } from './_shared-secret.js';

export const crossed = (alert, price) =>
  alert.direction === 'above' ? price >= alert.target_price : price <= alert.target_price;

const DAY = 24 * 3600 * 1000;

/** Earnings alerts fire within a day of the report; every other kind is a price crossing. */
export function hit(alert, quote, now = Date.now()) {
  if (alert.kind === 'earnings') return typeof quote.nextEarnings === 'number' && quote.nextEarnings * 1000 - now <= DAY;
  if (alert.kind === 'move') return typeof quote.changePercent === 'number' && Math.abs(quote.changePercent) >= alert.target_price;
  return typeof quote.price === 'number' && crossed(alert, quote.price);
}

/** Alerts whose quote hit, each with the live price attached. */
export function pickFired(alerts, quotes, now = Date.now()) {
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  return alerts
    .filter((a) => bySymbol.has(a.symbol) && hit(a, bySymbol.get(a.symbol), now))
    .map((a) => ({ ...a, price: bySymbol.get(a.symbol).price, changePercent: bySymbol.get(a.symbol).changePercent }));
}

export function alertLine(r) {
  const s = esc(r.symbol);
  if (r.kind === 'earnings') return `${s} reports earnings within a day. Now ${money(r.price)}.`;
  if (r.kind === 'move') return `${s} moved ${r.changePercent >= 0 ? '+' : ''}${Number(r.changePercent).toFixed(1)}% today. Now ${money(r.price)}.`;
  if (r.kind === 'high52') return `${s} hit a new 52 week high, past ${money(r.target_price)}. Now ${money(r.price)}.`;
  if (r.kind === 'low52') return `${s} hit a new 52 week low, under ${money(r.target_price)}. Now ${money(r.price)}.`;
  return `${s} is ${r.direction} ${money(r.target_price)}. Now ${money(r.price)}.`;
}

const money = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function alertEmail(rows) {
  const lines = rows.map(alertLine);
  return {
    subject: rows.length === 1 ? lines[0].split('.')[0] : `${rows.length} price alerts hit`,
    html: `<p>${lines.join('<br>')}</p><p><a href="https://epiphany.jaybulb.com">Open Epiphany</a></p>`
      + '<p style="color:#888;font-size:12px">You set these alerts in Epiphany. Each one emails once; delete an alert to stop it.</p>',
  };
}

export default async function handler(req, res) {
  const auth = verifyCronSecret(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (!sparkConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const active = ((await sparkRequest('alerts?triggered=eq.false&select=*')) || []).filter((a) => a.kind !== 'digest');
  if (!active.length) return res.status(200).json({ checked: 0, fired: 0 });

  const symbols = [...new Set(active.map((a) => a.symbol))];
  const quotes = (await fetchYahooBatch(symbols)) || [];
  const fired = pickFired(active, quotes);
  if (!fired.length) return res.status(200).json({ checked: active.length, fired: 0 });

  // Flip first, mail second: a failed write must never mean the same email every tick.
  // triggered=eq.false in the filter means two overlapping runs can't both claim a row.
  const ids = fired.map((a) => a.id).slice(0, 100);
  const claimed = await sparkRequest(`alerts?id=in.(${ids.join(',')})&triggered=eq.false`, {
    method: 'PATCH',
    body: { triggered: true },
  });
  const claimedIds = new Set((claimed || []).map((r) => r.id));
  const byUser = new Map();
  for (const a of fired) {
    if (!claimedIds.has(a.id)) continue;
    byUser.set(a.user_email, [...(byUser.get(a.user_email) || []), a]);
  }

  let sent = 0;
  for (const [to, rows] of byUser) {
    try { await sendEmail({ to, ...alertEmail(rows) }); sent += 1; } catch (e) { console.warn('[alerts-check] mail failed', e.message); }
  }
  return res.status(200).json({ checked: active.length, fired: claimedIds.size, emails: sent });
}
