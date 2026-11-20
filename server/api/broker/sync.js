// Read-only multi-broker sync. Pulls holdings + balances via SnapTrade and
// writes a snapshot to KV (separate key from the user-curated portfolio).
// No-ops cleanly when SnapTrade is not configured. Never places orders.
//
// POST /api/broker/sync  (authenticated session)
//   1. Ensures a SnapTrade user exists for the session (registers + caches secret in KV)
//   2. If no brokerage is linked yet, returns { linkUrl } for the connection portal
//   3. Otherwise returns + persists { holdings, balance }
import { checkRateLimit } from '../_ratelimit.js';
import { getKv } from '../_kv.js';
import { getSessionUser, errorResponse } from '../auth-helpers.js';
import { isPro } from '../gates.js';
import { SnapTradeAdapter, withCadTotals } from '../../../src/utils/brokers/snaptrade.js';
import { YAHOO_HEADERS } from '../stocks-shared.js';

// CADUSD=X: US dollars per Canadian dollar, so account totals can be summed in CAD.
async function usdPerCad() {
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/CADUSD=X?range=1d&interval=1d', { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(5000) });
    const price = (await r.json())?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return price > 0 ? price : null;
  } catch {
    return null;
  }
}

// Register, and if SnapTrade already has this user (code 1010) but we lost the
// secret, delete the orphan and register again. The user re-links their broker.
async function registerFresh(adapter, userId) {
  try {
    return await adapter.registerUser(userId);
  } catch (err) {
    if (!/1010|already exist/i.test(err.message)) throw err;
    await adapter.deleteUser(userId);
    return adapter.registerUser(userId);
  }
}

// When the broker's data was last pulled by SnapTrade, oldest account first: one stuck
// account should show, not hide behind the fresh ones. syncedAt is only when we asked.
export function oldestSync(accounts = []) {
  const times = accounts.map(a => Date.parse(a.holdingsAsOf)).filter(Number.isFinite);
  return times.length ? new Date(Math.min(...times)).toISOString() : null;
}

const STALE_MS = 3 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SnapTradeAdapter.isConfigured()) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'SnapTrade not configured' });
  }

  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');

  const kv = await getKv();
  const secretKey = `snaptrade:user:${session.userId}`;
  const snapshotKey = `broker:snapshot:${session.userId}`;
  // ponytail: per IP, matching every other limit here. Over the limit just reads the cached snapshot.
  const force = req.body?.force === true && await checkRateLimit(req, { prefix: 'rl:broker-sync', max: 10 });
  const connectAdditional = req.body?.action === 'connect-additional';
  const reconnect = req.body?.action === 'reconnect';

  try {
    if (!force && !connectAdditional && !reconnect && kv) {
      const cached = await kv.get(snapshotKey);
      // A refresh queued at SnapTrade has had two minutes to land: read through instead of the cache.
      const refreshLanded = cached?.refreshQueuedAt && Date.now() - Date.parse(cached.refreshQueuedAt) > 2 * 60 * 1000;
      if (!refreshLanded && cached?.syncedAt && (Date.now() - new Date(cached.syncedAt).getTime()) < 25 * 60 * 1000) {
        return res.status(200).json({ ok: true, linked: true, ...cached, cached: true });
      }
    }

    const adapter = new SnapTradeAdapter({ userId: session.userId });

    // Reuse a cached userSecret, or register the user once.
    const cached = kv ? await kv.get(secretKey) : null;
    if (cached?.userSecret) {
      adapter.userSecret = cached.userSecret;
    } else {
      const reg = await registerFresh(adapter, session.userId);
      if (kv) await kv.set(secretKey, { userSecret: reg.userSecret });
    }

    let accounts;
    try {
      accounts = await adapter.listAccounts();
    } catch (err) {
      // Stale userSecret (e.g. issued under a different SnapTrade env/key) --
      // re-register once instead of surfacing a hard 401/1083 to the user.
      if (cached?.userSecret && /1083|invalid userid|usersecret/i.test(err.message)) {
        if (kv) await kv.del(secretKey);
        const reg = await registerFresh(adapter, session.userId);
        if (kv) await kv.set(secretKey, { userSecret: reg.userSecret });
        accounts = await adapter.listAccounts();
      } else {
        throw err;
      }
    }
    // A broker that stopped sending data (expired login) shows as disabled; its old numbers sit
    // in the snapshot looking current. Reconnect re-auths that connection in the portal.
    if (reconnect) {
      // SnapTrade can leave an expired Wealthsimple login marked live: data over two days old counts as dead too.
      const conns = await adapter.listConnections().catch(() => []);
      const prior = kv ? await kv.get(snapshotKey) : null;
      const stuck = prior?.dataAsOf && Date.now() - Date.parse(prior.dataAsOf) > 48 * 3600 * 1000;
      const dead = conns.find(c => c.disabled) || (stuck ? conns[0] : null);
      if (dead) {
        // Expire the cached snapshot so the first sync after the portal pulls fresh numbers.
        const snap = kv ? await kv.get(snapshotKey) : null;
        if (snap) await kv.set(snapshotKey, { ...snap, syncedAt: null });
        return res.status(200).json({ ok: true, linked: true, linkUrl: await adapter.loginLink(null, dead.id) });
      }
    }
    if (!accounts || accounts.length === 0 || connectAdditional) {
      if (connectAdditional && !(await isPro(session, req))) {
        return res.status(200).json({ ok: true, upgradeRequired: true });
      }
      const broker = typeof req.body?.broker === 'string' ? req.body.broker.toUpperCase() : null;
      const linkUrl = await adapter.loginLink(broker);
      return res.status(200).json({ ok: true, linked: accounts?.length > 0, linkUrl });
    }

    const since = new Date(Date.now() - 2 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const fx = await usdPerCad();
    const [rawHoldings, rawBalance, snapAccounts, connections, activities] = await Promise.all([
      adapter.getHoldings(), adapter.getBalance(), adapter.getAccounts({ usdPerCad: fx }), adapter.listConnections().catch(() => []),
      adapter.getActivities({ startDate: since }).catch(() => []),
    ]);
    // Activities give what /positions doesn't: cost basis (for gain/loss on
    // synced holdings) and dividend income.
    const basis = SnapTradeAdapter.costBasisFromActivities(activities);
    const { holdings: cadHoldings, balance, currency, usdPerCad: rate, fxMissing, netWorthCad } =
      withCadTotals({ holdings: rawHoldings, balance: rawBalance }, fx);
    const holdings = cadHoldings.map(h => ({ ...h, costBasis: basis[h.symbol] ?? null }));
    const yearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const dividends12m = activities
      .filter(a => a.type === 'DIVIDEND' && String(a.date) >= yearAgo)
      .reduce((sum, a) => sum + Math.abs(a.amount), 0);
    const snapshot = {
      holdings, balance, accounts: snapAccounts, currency, usdPerCad: rate, fxMissing, netWorthCad, connections,
      activities: activities.slice(0, 50), dividends12m, syncedAt: new Date().toISOString(),
      dataAsOf: oldestSync(snapAccounts), dailyOnly: connections.some(c => c.delayed),
    };
    // SnapTrade only re-reads a daily connection (Wealthsimple) about once a day, so balances sat a
    // day or more behind. When the broker data is over STALE_MS old, ask for a refresh, at most once
    // per STALE_MS per user; the next sync after it lands reads the new numbers.
    const staleKey = `snaptrade:refreshed:${session.userId}`;
    const dataAge = snapshot.dataAsOf ? Date.now() - Date.parse(snapshot.dataAsOf) : Infinity;
    if (kv && (force || dataAge > STALE_MS) && !(await kv.get(staleKey))) {
      const live = connections.filter(c => !c.disabled);
      const queued = await Promise.all(live.map(c => adapter.refreshConnection(c.id).then(() => true, (e) => {
        console.warn(`[BROKER/SYNC] refresh ${c.id} failed:`, e?.message || e);
        return false;
      })));
      if (queued.some(Boolean)) {
        snapshot.refreshQueuedAt = new Date().toISOString();
        await kv.set(staleKey, 1, { ex: Math.round(STALE_MS / 1000) });
      }
    }
    if (kv) await kv.set(snapshotKey, snapshot);

    console.log(`[BROKER/SYNC] ${session.userId}: data as of ${snapshot.dataAsOf}, connections ${JSON.stringify(connections.map(c => ({ b: c.brokerName, off: c.disabled, daily: c.delayed })))}, refresh ${snapshot.refreshQueuedAt ? 'queued' : 'not queued'}`);
    console.log(`[BROKER/SYNC] ${session.userId}: ${holdings.length} holdings, $${balance.totalCad.toFixed(2)} CAD cash${fxMissing ? ' (FX missing, flagged)' : ''}`);
    return res.status(200).json({ ok: true, linked: true, ...snapshot });
  } catch (err) {
    // Upstream detail stays in the logs; the clients (iOS/macOS/web) render
    // `error` verbatim, so never hand them a raw SnapTrade payload.
    console.error('[BROKER/SYNC] Error:', err?.stack || String(err));
    return res.status(502).json({ ok: false, error: 'Brokerage temporarily unavailable' });
  }
}
