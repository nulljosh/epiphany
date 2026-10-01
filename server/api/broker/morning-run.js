// Autopilot run for enrolled premium users.
// Trigger: one Cloudflare Cron Trigger at open (wrangler.jsonc, 30 14 * * 1-5),
// authed with Bearer CRON_SECRET. So this fires once per weekday, not hourly —
// the GitHub Actions hourly tick this once referenced (.github/workflows/
// autopilot.yml) does not exist and may never have. The handler still guards
// market hours (9:30–16:00 ET Mon–Fri) and dedupes to one run per clock hour
// via KV, so the hour granularity is now belt-and-braces rather than load-
// bearing; keep it, since the KV lock is also what protects against a second
// platform ever being armed by mistake.
//
// The rule is Trend 2x (WHITEPAPER section 1): one signal from SPY's daily closes. Above its 200 day
// average the target is SSO (2x S&P 500), below it BIL (T-bills). Each user is sized to the target and the
// other side is sold, so a switch only happens when the side changes. Paper mode logs simulated
// fills against a KV position book. Live mode (real orders through the user's
// linked SnapTrade brokerage) exists below but is unreachable -- autopilot.js
// forces mode to 'paper' until live execution is vetted further.
import { getKv } from '../_kv.js';
import { verifyCronSecret } from '../_shared-secret.js';
import { isProByEmail } from '../gates.js';
import { SnapTradeAdapter } from '../../../src/utils/brokers/snaptrade.js';
import { trend2x } from '../../../src/utils/indicators.js';

const TREND_SYMBOL = 'SPY';
const TRADE_LOG_LIMIT = 100;

// Live mode: hard-capped per-trade notional and total fill
// count -- once the cap is hit, auto-flips the user back to paper instead of
// trading unsupervised forever. Raise/replace once live execution is trusted
// further.
const LIVE_PROBE_ORDER_SYMBOL = 'BTC';
const LIVE_MAX_NOTIONAL = 50; // hard $ cap per live trade, overrides user setting
const LIVE_PROBE_TRADE_CAP = 20;

async function getDailyCloses(symbol) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`);
  if (!r.ok) return null;
  const j = await r.json();
  const result = j?.chart?.result?.[0];
  const closes = (result?.indicators?.quote?.[0]?.close || []).filter((c) => typeof c === 'number');
  const price = result?.meta?.regularMarketPrice ?? closes[closes.length - 1] ?? null;
  return closes.length >= 60 && price ? { closes, price } : null;
}

// Today's price replaces the last close (the cron runs inside the session), then the rule reads the series.
// Returns the two trend signals: buy the target side, sell the other, or [] without enough history.
function buildTrendSignals(data, prices) {
  const series = [...data.closes.slice(0, -1), data.price];
  const t = trend2x(series);
  if (!t) return { trend: null, signals: [] };
  const signals = [];
  if (prices[t.other]) signals.push({ symbol: t.other, signal: 'sell', price: prices[t.other], trend: true });
  if (prices[t.symbol]) signals.push({ symbol: t.symbol, signal: 'buy', price: prices[t.symbol], trend: true });
  return { trend: t, signals };
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
    const held = pos[sig.symbol] || 0;
    if (sig.signal === 'sell') {
      qty = isCrypto ? Math.min(qty, held) : Math.min(qty, Math.floor(held));
    } else if (sig.trend) {
      qty = Math.max(0, qty - Math.floor(held)); // already on this side: top up to the cap, never stack daily
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
      const held = holdings.filter((h) => h.symbol === sig.symbol).reduce((s, h) => s + h.shares, 0);
      if (sig.signal === 'sell') {
        qty = isCrypto ? Math.min(qty, held) : Math.min(qty, Math.floor(held));
      } else if (sig.trend) {
        qty = Math.max(0, qty - Math.floor(held)); // already on this side: top up to the cap, never stack daily
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

  // Live: hard-capped per-trade notional and total fill count, auto-reverts to paper.
  const countKey = `autopilot:liveCount:${userId}`;
  const liveCount = Number((await kv.get(countKey)) || 0);
  if (liveCount >= LIVE_PROBE_TRADE_CAP) {
    await kv.set(`autopilot:${userId}`, { ...ap, mode: 'paper' });
    return { userId, mode: 'live', skipped: `live trade cap (${LIVE_PROBE_TRADE_CAP}) reached -- reverted to paper` };
  }

  const liveNotional = Math.min(maxNotional, LIVE_MAX_NOTIONAL);
  const remaining = LIVE_PROBE_TRADE_CAP - liveCount;
  const actionable = signals.filter((s) => s.signal).slice(0, remaining);
  if (!actionable.length) return { userId, mode: 'live', skipped: 'no actionable signal' };

  const trades = await runLive(kv, userId, actionable, liveNotional);
  const filled = trades.filter((t) => !t.error).length;
  if (filled > 0) await kv.set(countKey, liveCount + filled);
  return { userId, mode: 'live', trades, liveCount: liveCount + filled };
}

async function getPrice(symbol) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`);
  if (!r.ok) return null;
  const result = (await r.json())?.chart?.result?.[0];
  const closes = (result?.indicators?.quote?.[0]?.close || []).filter((c) => typeof c === 'number');
  return result?.meta?.regularMarketPrice ?? closes[closes.length - 1] ?? null;
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
  const cronAuth = verifyCronSecret(req);
  if (!cronAuth.ok) return res.status(cronAuth.status).json({ error: cronAuth.error });

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

  // One signal: SPY against its 200 day average. SSO and BIL prices come with it.
  let trend = null;
  let actionable = [];
  try {
    const spy = await getDailyCloses(TREND_SYMBOL);
    const [sso, bil] = await Promise.all(['SSO', 'BIL'].map((sym) => getPrice(sym)));
    if (spy && sso && bil) {
      ({ trend, signals: actionable } = buildTrendSignals(spy, { SSO: sso, BIL: bil }));
    }
    console.log(`[MORNING-RUN] SPY $${spy?.price} vs 200d ${trend ? trend.avg.toFixed(2) : 'n/a'} -> ${trend ? trend.symbol : 'hold'}`);
  } catch (err) {
    console.error('[MORNING-RUN] trend signal:', err.message);
  }

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

  return res.status(200).json({ ok: true, rule: 'trend2x', trend: trend && { side: trend.side, target: trend.symbol, last: trend.last, avg: trend.avg }, signals: actionable, users: results.length, results, runAt: new Date().toISOString() });
}
