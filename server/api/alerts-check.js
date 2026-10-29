// Price alerts with every app closed: a cron tick checks each untriggered alert against live
// quotes, flips the ones that crossed, then emails each owner once for everything that fired.
// ponytail: email, not APNs. Swap in push when an APNs key exists (#180).
import { sparkRequest, sparkConfigured } from './spark.js';
import { fetchYahooBatch } from './stocks-free.js';
import { sendEmail } from './_email.js';
import { verifyCronSecret } from './_shared-secret.js';

export const crossed = (alert, price) =>
  alert.direction === 'above' ? price >= alert.target_price : price <= alert.target_price;

/** Alerts whose symbol has a live price past the target, each with that price attached. */
export function pickFired(alerts, quotes) {
  const prices = new Map(quotes.map((q) => [q.symbol, q.price]));
  return alerts
    .filter((a) => typeof prices.get(a.symbol) === 'number' && crossed(a, prices.get(a.symbol)))
    .map((a) => ({ ...a, price: prices.get(a.symbol) }));
}

const money = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function alertEmail(rows) {
  const lines = rows.map((r) => `${esc(r.symbol)} is ${r.direction} ${money(r.target_price)}. Now ${money(r.price)}.`);
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

  const active = (await sparkRequest('alerts?triggered=eq.false&select=*')) || [];
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
