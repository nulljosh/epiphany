// Read-only multi-broker sync. Pulls holdings + balances via SnapTrade and
// writes a snapshot to KV (separate key from the user-curated portfolio).
// No-ops cleanly when SnapTrade is not configured. Never places orders.
//
// POST /api/broker/sync  (authenticated session)
//   1. Ensures a SnapTrade user exists for the session (registers + caches secret in KV)
//   2. If no brokerage is linked yet, returns { linkUrl } for the connection portal
//   3. Otherwise returns + persists { holdings, balance }
import { getKv } from '../_kv.js';
import { getSessionUser, errorResponse } from '../auth-helpers.js';
import { SnapTradeAdapter } from '../../../src/utils/brokers/snaptrade.js';

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
  const force = req.body?.force === true;

  try {
    if (!force && kv) {
      const cached = await kv.get(snapshotKey);
      if (cached?.syncedAt && (Date.now() - new Date(cached.syncedAt).getTime()) < 25 * 60 * 1000) {
        return res.status(200).json({ ok: true, linked: true, ...cached, cached: true });
      }
    }

    const adapter = new SnapTradeAdapter({ userId: session.userId });

    // Reuse a cached userSecret, or register the user once.
    const cached = kv ? await kv.get(secretKey) : null;
    if (cached?.userSecret) {
      adapter.userSecret = cached.userSecret;
    } else {
      const reg = await adapter.registerUser(session.userId);
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
        const reg = await adapter.registerUser(session.userId);
        if (kv) await kv.set(secretKey, { userSecret: reg.userSecret });
        accounts = await adapter.listAccounts();
      } else {
        throw err;
      }
    }
    if (!accounts || accounts.length === 0) {
      const broker = typeof req.body?.broker === 'string' ? req.body.broker.toUpperCase() : null;
      const linkUrl = await adapter.loginLink(broker);
      return res.status(200).json({ ok: true, linked: false, linkUrl });
    }

    const since = new Date(Date.now() - 2 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const [rawHoldings, balance, snapAccounts, connections, activities] = await Promise.all([
      adapter.getHoldings(), adapter.getBalance(), adapter.getAccounts(), adapter.listConnections().catch(() => []),
      adapter.getActivities({ startDate: since }).catch(() => []),
    ]);
    // Activities give what /positions doesn't: cost basis (for gain/loss on
    // synced holdings) and dividend income.
    const basis = SnapTradeAdapter.costBasisFromActivities(activities);
    const holdings = rawHoldings.map(h => ({ ...h, costBasis: basis[h.symbol] ?? null }));
    const yearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const dividends12m = activities
      .filter(a => a.type === 'DIVIDEND' && String(a.date) >= yearAgo)
      .reduce((sum, a) => sum + Math.abs(a.amount), 0);
    const snapshot = {
      holdings, balance, accounts: snapAccounts, connections,
      activities: activities.slice(0, 50), dividends12m, syncedAt: new Date().toISOString(),
    };
    if (kv) await kv.set(snapshotKey, snapshot);

    console.log(`[BROKER/SYNC] ${session.userId}: ${holdings.length} holdings, $${balance.total.toFixed(2)} cash`);
    return res.status(200).json({ ok: true, linked: true, ...snapshot });
  } catch (err) {
    // Upstream detail stays in the logs; the clients (iOS/macOS/web) render
    // `error` verbatim, so never hand them a raw SnapTrade payload.
    console.error('[BROKER/SYNC] Error:', err.message);
    return res.status(502).json({ ok: false, error: 'Brokerage temporarily unavailable' });
  }
}
