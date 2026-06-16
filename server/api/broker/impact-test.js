// Signing-health probe: runs the exact /trade/impact call autopilot uses
// (the request that 401'd with code 1076) WITHOUT confirming the trade —
// SnapTrade executes nothing until /trade/{tradeId} is posted, which this
// endpoint never does. CRON_SECRET-gated.
//
// GET /api/broker/impact-test[?userId=...&symbol=AAPL]
import { getKv } from '../_kv.js';
import { SnapTradeAdapter } from '../../../src/utils/brokers/snaptrade.js';

const DEFAULT_USER = '6ac57c6c-6975-4eaf-b306-d58fd8b3b784';

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SnapTradeAdapter.isConfigured()) {
    return res.status(200).json({ ok: false, error: 'SnapTrade not configured' });
  }

  const kv = await getKv();
  if (!kv) return res.status(200).json({ ok: false, error: 'KV unavailable' });

  const userId = typeof req.query?.userId === 'string' ? req.query.userId : DEFAULT_USER;
  const symbol = typeof req.query?.symbol === 'string' ? req.query.symbol.toUpperCase() : 'AAPL';

  try {
    const secret = await kv.get(`snaptrade:user:${userId}`);
    if (!secret?.userSecret) return res.status(200).json({ ok: false, error: 'No SnapTrade user secret in KV' });

    const adapter = new SnapTradeAdapter({ userId });
    adapter.userSecret = secret.userSecret;

    const accounts = await adapter.listAccounts();
    if (!accounts?.length) return res.status(200).json({ ok: false, error: 'No linked accounts' });

    const impact = await adapter.tradeImpact({ accountId: accounts[0].id, symbol, side: 'buy', qty: 1 });
    console.log(`[IMPACT-TEST] ${userId} ${symbol}: signature OK, tradeId ${impact?.trade?.id}`);
    return res.status(200).json({ ok: true, signatureVerified: true, symbol, impact });
  } catch (err) {
    console.error('[IMPACT-TEST] Error:', err.message);
    return res.status(502).json({ ok: false, signatureVerified: false, error: err.message });
  }
}
