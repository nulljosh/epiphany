// Daily portfolio value for every user, so value charts (28.0) and rate of return (37.0) have a history.
// ponytail: KEYS user:* walks every account; fine at today's user count, a users index if it grows.
import { getKv } from './_kv.js';
import { sparkConfigured } from './spark.js';
import { fetchYahooBatch } from './stocks-free.js';
import { verifyCronSecret } from './_shared-secret.js';
import { withBrokerOverlay } from './portfolio.js';
import { saveSnapshot } from './portfolio-history.js';

/** Holdings at today's price (stored market value when there's no quote) plus cash, like the web's net worth. */
export function portfolioValue(data, quotes = []) {
  const price = Object.fromEntries(quotes.filter((q) => q?.symbol && q.price > 0).map((q) => [q.symbol, q.price]));
  const stocks = (data.holdings || []).reduce((sum, h) =>
    sum + (price[h.symbol] ? h.shares * price[h.symbol] : Number(h.marketValue) || 0), 0);
  const cash = (data.accounts || []).reduce((sum, a) => sum + (Number(a.cash ?? a.balance) || 0), 0);
  return Math.round((stocks + cash) * 100) / 100;
}

export default async function handler(req, res) {
  const auth = verifyCronSecret(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (!sparkConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const kv = await getKv();
  let saved = 0;
  for (const key of await kv.keys('user:*')) {
    const user = await kv.get(key);
    if (!user?.id || !user.email) continue;
    const stored = await kv.get(`portfolio:${user.id}`);
    if (!stored) continue;
    const data = withBrokerOverlay(stored, await kv.get(`broker:snapshot:${user.id}`));
    if (!data.holdings?.length && !data.accounts?.length) continue;
    const symbols = [...new Set((data.holdings || []).map((h) => h.symbol))].slice(0, 50);
    const quotes = symbols.length ? (await fetchYahooBatch(symbols)) || [] : [];
    try {
      await saveSnapshot(user.email, { total_value: portfolioValue(data, quotes) });
      saved += 1;
    } catch (e) { console.warn('[portfolio-snapshot] save failed', e.message); }
  }
  return res.status(200).json({ saved });
}
