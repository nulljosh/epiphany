// Weekend crypto paper trading. Crypto never closes, so the daily Cron Trigger (0 12 * * *, every day of the
// week) runs this beside the weekday-only stock autopilot. Paper only: it never places a real order.
// The rule is plain BTC trend: hold BTC while it is above its 100 day average, otherwise sit in cash.
// Users opt in with autopilot enabled + allowCrypto + paper mode. Size is allocation % of a virtual $10,000.
// Fills land in the same trade log the Autopilot screen already reads.
import { getKv } from '../_kv.js';
import { verifyCronSecret } from '../_shared-secret.js';
import { sma } from '../../../src/utils/indicators.js';

const PAPER_BASE = 10000;
const TRADE_LOG_LIMIT = 100;
const AVG_DAYS = 100;

async function btcCloses() {
  const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1d&range=1y');
  if (!r.ok) return null;
  const result = (await r.json())?.chart?.result?.[0];
  const closes = (result?.indicators?.quote?.[0]?.close || []).filter((c) => typeof c === 'number');
  const price = result?.meta?.regularMarketPrice ?? closes[closes.length - 1];
  return closes.length > AVG_DAYS && price ? { series: [...closes.slice(0, -1), price], price } : null;
}

async function runUser(kv, userId, ap, { price, above }) {
  const key = `paperpos:crypto:${userId}`;
  const pos = (await kv.get(key)) || {};
  const held = pos.BTC || 0;
  const alloc = Number(ap.allocation) > 0 ? Number(ap.allocation) : 10;
  let side = null;
  let qty = 0;
  if (above && held === 0) {
    side = 'buy';
    qty = Number(((PAPER_BASE * alloc) / 100 / price).toFixed(8));
  } else if (!above && held > 0) {
    side = 'sell';
    qty = held;
  }
  if (!side || qty <= 0) return { userId, skipped: 'already on this side' };
  await kv.set(key, { BTC: side === 'buy' ? qty : 0 });
  const trade = { ts: new Date().toISOString(), symbol: 'BTC', side, qty, price, mode: 'paper', crypto: true };
  const log = (await kv.get(`trades:${userId}`)) || [];
  await kv.set(`trades:${userId}`, [trade, ...log].slice(0, TRADE_LOG_LIMIT));
  return { userId, trade };
}

export default async function handler(req, res) {
  const auth = verifyCronSecret(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const kv = await getKv();
  if (!kv) return res.status(200).json({ ok: false, error: 'KV unavailable' });

  const data = await btcCloses().catch(() => null);
  if (!data) return res.status(200).json({ ok: false, error: 'no BTC prices' });
  const avg = sma(data.series, AVG_DAYS);
  const signal = { price: data.price, above: data.price > avg };

  const results = [];
  for (const userId of (await kv.get('autopilot:users')) || []) {
    const ap = await kv.get(`autopilot:${userId}`);
    if (!ap?.enabled || !ap.allowCrypto || ap.mode === 'live') continue;
    try {
      results.push(await runUser(kv, userId, ap, signal));
    } catch (err) {
      results.push({ userId, error: err.message });
    }
  }
  return res.status(200).json({ ok: true, rule: 'btc-trend100', price: data.price, avg, above: signal.above, results });
}
