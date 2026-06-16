// POST /api/broker/trade — manual order placement via SnapTrade.
// Premium only. Request: { accountId, symbol, side, qty }.
// Response: SnapTrade trade confirmation or error.
import { getSessionUser, errorResponse } from '../auth-helpers.js';
import { isPro } from '../gates.js';
import { SnapTradeAdapter } from '../../src/utils/brokers/snaptrade.js';
import { getKv } from '../_kv.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');

  if (!(await isPro(session))) return errorResponse(res, 402, 'Premium required');

  const { accountId, symbol, side, qty } = req.body || {};
  if (!accountId || !symbol || !side || !qty) {
    return res.status(400).json({ error: 'Missing required fields: accountId, symbol, side, qty' });
  }

  if (!['buy', 'sell'].includes(side.toLowerCase())) {
    return res.status(400).json({ error: 'side must be buy or sell' });
  }

  const kv = await getKv();
  if (!kv) return res.status(503).json({ error: 'Storage unavailable' });

  try {
    const userKey = `snaptrade:user:${session.userId}`;
    const userCreds = await kv.get(userKey);
    if (!userCreds || !userCreds.userId || !userCreds.userSecret) {
      return res.status(400).json({ error: 'Brokerage not connected' });
    }

    const adapter = new SnapTradeAdapter({ userId: userCreds.userId, userSecret: userCreds.userSecret });
    const result = await adapter.placeOrder({
      accountId,
      symbol,
      side: side.toLowerCase(),
      qty: Number(qty),
    });

    // Log trade for audit
    const trades = (await kv.get(`trades:${session.userId}`)) || [];
    trades.push({
      symbol,
      side: side.toLowerCase(),
      qty: Number(qty),
      mode: 'live',
      timestamp: new Date().toISOString(),
      result: result?.id || result?.trade?.id,
    });
    await kv.set(`trades:${session.userId}`, trades.slice(-100)); // Keep last 100

    console.log(`[TRADE] ${session.userId}: ${side.toUpperCase()} ${qty} ${symbol}`);
    return res.status(200).json({ ok: true, trade: result });
  } catch (err) {
    console.error(`[TRADE] Error for ${session.userId}:`, err.message);
    return res.status(400).json({ error: err.message });
  }
}
