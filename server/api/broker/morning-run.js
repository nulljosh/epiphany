// Autopilot run for enrolled premium users — fires hourly during market hours.
// Triggers: Vercel cron at open (vercel.json, 14:30 UTC weekdays — Hobby plan
// allows daily only) + GitHub Actions hourly ticks (.github/workflows/autopilot.yml),
// both authed with Bearer CRON_SECRET. The handler itself guards market hours
// (9:30–16:00 ET Mon–Fri) and dedupes to one run per clock hour via KV, so
// extra or overlapping triggers are no-ops.
//
// Signals are computed once per watchlist symbol from 6 months of daily closes
// (drift/vol estimated from log returns, SMA20/50 momentum tilt, GBM Monte
// Carlo bull probability), then executed per user: paper mode logs simulated
// fills against a KV position book. Live mode (real orders through the user's
// linked SnapTrade brokerage) exists below but is unreachable -- autopilot.js
// forces mode to 'paper' until live execution is vetted further.
import { getKv } from '../_kv.js';
import { isProByEmail } from '../gates.js';
import { SnapTradeAdapter } from '../../../src/utils/brokers/snaptrade.js';

const WATCHLIST = ['AAPL', 'NVDA', 'MSFT', 'SPY', 'QQQ'];
const SIGNAL_THRESHOLD = 0.55; // bull prob > 55% = buy, < 45% = sell
const MOMENTUM_TILT_CAP = 0.08;
const TRADE_LOG_LIMIT = 100;

// Live mode is in a "get the ball rolling" probe phase: BTC only (cheap,
// fractional-qty friendly, low blast radius), and hard-capped at a handful
// of fills total -- once hit, auto-flips the user back to paper instead of
// trading unsupervised forever. Raise/replace once live execution is trusted.
const LIVE_PROBE_ORDER_SYMBOL = 'BTC';
const LIVE_PROBE_PRICE_SYMBOL = 'BTC-USD'; // Yahoo ticker for the price/signal series
const LIVE_PROBE_TRADE_CAP = 3;

// GBM Monte Carlo — 500 paths, 30-day horizon, params estimated per symbol.
function monteCarlo(price, mu, sigma, paths = 500, days = 30) {
  let bull = 0;
  for (let p = 0; p < paths; p++) {
    let s = price;
    for (let d = 0; d < days; d++) {
      const z = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
      s *= Math.exp((mu - 0.5 * sigma * sigma) + sigma * z);
    }
    if (s > price) bull++;
  }
  return bull / paths;
}

async function getDailyCloses(symbol) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo`);
  if (!r.ok) return null;
  const j = await r.json();
  const result = j?.chart?.result?.[0];
  const closes = (result?.indicators?.quote?.[0]?.close || []).filter((c) => typeof c === 'number');
  const price = result?.meta?.regularMarketPrice ?? closes[closes.length - 1] ?? null;
  return closes.length >= 60 && price ? { closes, price } : null;
}

function sma(values, n) {
  const slice = values.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function buildSignal(closes, price) {
  const rets = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const mu = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sigma = Math.sqrt(rets.reduce((a, b) => a + (b - mu) ** 2, 0) / (rets.length - 1));

  let prob = monteCarlo(price, mu, sigma);
  // Momentum tilt: SMA20 above SMA50 nudges bullish, below nudges bearish.
  const momentum = sma(closes, 20) / sma(closes, 50) - 1;
  prob += Math.max(-MOMENTUM_TILT_CAP, Math.min(MOMENTUM_TILT_CAP, momentum * 2));

  const signal = prob > SIGNAL_THRESHOLD ? 'buy' : prob < 1 - SIGNAL_THRESHOLD ? 'sell' : null;
  return { prob: Number(prob.toFixed(3)), momentum: Number(momentum.toFixed(4)), signal };
}

async function appendTrades(kv, userId, trades) {
  if (!trades.length) return;
  const log = (await kv.get(`trades:${userId}`)) || [];
  await kv.set(`trades:${userId}`, [...trades, ...log].slice(0, TRADE_LOG_LIMIT));
}

async function runPaper(kv, userId, signals, maxNotional) {
  const pos = (await kv.get(`paperpos:${userId}`)) || {};
  const trades = [];
  const ts = new Date().toISOString();
  for (const sig of signals) {
    const isCrypto = sig.symbol === LIVE_PROBE_ORDER_SYMBOL;
    let qty = isCrypto
      ? Number((maxNotional / sig.price).toFixed(8))
      : Math.floor(maxNotional / sig.price);
    if (sig.signal === 'sell') {
      const held = pos[sig.symbol] || 0;
      qty = isCrypto ? Math.min(qty, held) : Math.min(qty, Math.floor(held));
    }
    if (qty <= 0 || (!isCrypto && qty < 1)) continue;
    pos[sig.symbol] = (pos[sig.symbol] || 0) + (sig.signal === 'buy' ? qty : -qty);
    trades.push({ ts, symbol: sig.symbol, side: sig.signal, qty, price: sig.price, mode: 'paper' });
  }
  await kv.set(`paperpos:${userId}`, pos);
  await appendTrades(kv, userId, trades);
  return trades;
}

async function runLive(kv, userId, signals, maxNotional) {
  const secret = await kv.get(`snaptrade:user:${userId}`);
  if (!secret?.userSecret) throw new Error('no brokerage link');
  const adapter = new SnapTradeAdapter({ userId, userSecret: secret.userSecret });
  const accounts = await adapter.listAccounts();
  const accountId = accounts?.[0]?.id;
  if (!accountId) throw new Error('no linked account');

  const holdings = await adapter.getHoldings();
  const trades = [];
  for (const sig of signals) {
    const ts = new Date().toISOString();
    try {
      const isCrypto = sig.symbol === LIVE_PROBE_ORDER_SYMBOL;
      // Crypto trades fractionally; equities are whole shares.
      let qty = isCrypto
        ? Number((maxNotional / sig.price).toFixed(8))
        : Math.floor(maxNotional / sig.price);
      if (sig.signal === 'sell') {
        const held = holdings.filter((h) => h.symbol === sig.symbol).reduce((s, h) => s + h.shares, 0);
        qty = isCrypto ? Math.min(qty, held) : Math.min(qty, Math.floor(held));
      }
      if (qty <= 0 || (!isCrypto && qty < 1)) continue;
      const order = await adapter.placeOrder({ accountId, symbol: sig.symbol, side: sig.signal, qty });
      trades.push({
        ts, symbol: sig.symbol, side: sig.signal, qty, price: sig.price, mode: 'live',
        orderId: order?.id ?? order?.brokerage_order_id ?? null,
      });
    } catch (err) {
      console.error(`[MORNING-RUN] order failed for ${userId} ${sig.symbol} ${sig.signal}:`, err.message);
      trades.push({ ts, symbol: sig.symbol, side: sig.signal, price: sig.price, mode: 'live', error: err.message });
    }
  }

  // Keep the Portfolio tab's broker snapshot in sync after live orders.
  try {
    const [holdingsAfter, balance] = await Promise.all([adapter.getHoldings(), adapter.getBalance()]);
    await kv.set(`broker:snapshot:${userId}`, { holdings: holdingsAfter, balance, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error(`[MORNING-RUN] snapshot refresh failed for ${userId}:`, err.message);
  }

  await appendTrades(kv, userId, trades);
  return trades;
}

async function getLiveProbeSignal() {
  const data = await getDailyCloses(LIVE_PROBE_PRICE_SYMBOL);
  if (!data) return null;
  const sig = buildSignal(data.closes, data.price);
  return { symbol: LIVE_PROBE_ORDER_SYMBOL, price: data.price, ...sig };
}

async function executeForUser(kv, userId, signals) {
  const ap = await kv.get(`autopilot:${userId}`);
  if (!ap?.enabled) return { userId, skipped: 'disabled' };
  if (!(await isProByEmail(ap.email))) return { userId, skipped: 'not premium' };

  const cap = Number(ap.maxNotional);
  const maxNotional = Number.isFinite(cap) && cap > 0 ? cap : 500;

  if (ap.mode !== 'live') {
    const trades = await runPaper(kv, userId, signals, maxNotional);
    return { userId, mode: ap.mode, trades };
  }

  // Live probe phase: BTC only, hard-capped trade count, auto-reverts to paper.
  const countKey = `autopilot:liveCount:${userId}`;
  const liveCount = Number((await kv.get(countKey)) || 0);
  if (liveCount >= LIVE_PROBE_TRADE_CAP) {
    await kv.set(`autopilot:${userId}`, { ...ap, mode: 'paper' });
    return { userId, mode: 'live', skipped: `live probe cap (${LIVE_PROBE_TRADE_CAP}) reached -- reverted to paper` };
  }

  const btcSignal = await getLiveProbeSignal();
  if (!btcSignal?.signal) return { userId, mode: 'live', skipped: 'no actionable BTC signal' };

  const trades = await runLive(kv, userId, [btcSignal], maxNotional);
  const filled = trades.filter((t) => !t.error).length;
  if (filled > 0) await kv.set(countKey, liveCount + filled);
  return { userId, mode: 'live', trades, liveCount: liveCount + filled };
}

function marketOpenNow() {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = et.getHours() * 60 + et.getMinutes();
  return mins >= 570 && mins < 960; // 9:30–16:00 ET
}

export default async function handler(req, res) {
  // Auth: Vercel cron and GitHub Actions send Authorization: Bearer <CRON_SECRET>
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const kv = await getKv();
  if (!kv) return res.status(200).json({ ok: false, error: 'KV unavailable' });

  // ?force=1 bypasses the market-hours and once-per-hour guards (manual testing)
  if (req.query?.force !== '1') {
    if (!marketOpenNow()) {
      return res.status(200).json({ ok: true, skipped: 'market closed' });
    }
    const hourKey = `autopilot:run:${new Date().toISOString().slice(0, 13)}`;
    if (await kv.get(hourKey)) {
      return res.status(200).json({ ok: true, skipped: 'already ran this hour' });
    }
    await kv.set(hourKey, 1, { ex: 7200 });
  }

  const signals = [];
  for (const symbol of WATCHLIST) {
    try {
      const data = await getDailyCloses(symbol);
      if (!data) { signals.push({ symbol, skipped: true }); continue; }
      const sig = buildSignal(data.closes, data.price);
      console.log(`[MORNING-RUN] ${symbol} $${data.price} bull=${(sig.prob * 100).toFixed(1)}% mom=${sig.momentum} → ${sig.signal || 'hold'}`);
      signals.push({ symbol, price: data.price, ...sig });
    } catch (err) {
      console.error(`[MORNING-RUN] ${symbol}:`, err.message);
      signals.push({ symbol, error: err.message });
    }
  }

  const actionable = signals.filter((s) => s.signal && s.price);
  // Paper mode also trades BTC (fractional-qty friendly, matches the live probe
  // symbol) so a sub-$1 cap has something to actually buy -- whole-share stocks
  // never clear the floor() at penny notional caps.
  const btcSignal = await getLiveProbeSignal();
  if (btcSignal?.signal) actionable.push(btcSignal);

  const enrolled = (await kv.get('autopilot:users')) || [];
  const results = [];
  for (const userId of enrolled) {
    try {
      results.push(await executeForUser(kv, userId, actionable));
    } catch (err) {
      console.error(`[MORNING-RUN] user ${userId}:`, err.message);
      results.push({ userId, error: err.message });
    }
  }

  return res.status(200).json({ ok: true, signals, users: results.length, results, runAt: new Date().toISOString() });
}
