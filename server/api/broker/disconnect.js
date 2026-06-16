// Disconnect a linked brokerage. Deletes the SnapTrade authorization(s) and
// clears the cached snapshot so the next sync starts from the connection portal.
//
// POST /api/broker/disconnect  (authenticated session)
//   body: { connectionId? }  -- omit to remove all linked brokerages
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

  try {
    const adapter = new SnapTradeAdapter({ userId: session.userId });
    const cached = kv ? await kv.get(secretKey) : null;
    if (!cached?.userSecret) return res.status(200).json({ ok: true, removed: 0 });
    adapter.userSecret = cached.userSecret;

    const connections = await adapter.listConnections();
    const targetId = req.body?.connectionId;
    const targets = targetId ? connections.filter(c => c.id === targetId) : connections;

    for (const c of targets) await adapter.removeConnection(c.id);
    if (kv) await kv.del(snapshotKey);

    console.log(`[BROKER/DISCONNECT] ${session.userId}: removed ${targets.length} connection(s)`);
    return res.status(200).json({ ok: true, removed: targets.length });
  } catch (err) {
    console.error('[BROKER/DISCONNECT] Error:', err.message);
    return res.status(502).json({ ok: false, error: err.message });
  }
}
