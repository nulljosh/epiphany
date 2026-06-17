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

    const accounts = await adapter.listAccounts();
    if (!accounts || accounts.length === 0) {
      const broker = typeof req.body?.broker === 'string' ? req.body.broker.toUpperCase() : null;
      const linkUrl = await adapter.loginLink(broker);
      return res.status(200).json({ ok: true, linked: false, linkUrl });
    }

    const [holdings, balance, snapAccounts, connections] = await Promise.all([
      adapter.getHoldings(), adapter.getBalance(), adapter.getAccounts(), adapter.listConnections().catch(() => []),
    ]);
    const snapshot = { holdings, balance, accounts: snapAccounts, connections, syncedAt: new Date().toISOString() };
    if (kv) await kv.set(snapshotKey, snapshot);

    console.log(`[BROKER/SYNC] ${session.userId}: ${holdings.length} holdings, $${balance.total.toFixed(2)} cash`);
    return res.status(200).json({ ok: true, linked: true, ...snapshot });
  } catch (err) {
    console.error('[BROKER/SYNC] Error:', err.message);
    return res.status(502).json({ ok: false, error: err.message });
  }
}
