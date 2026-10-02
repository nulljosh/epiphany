// POST/GET /api/broker/ibkr-report: the Mac's IBKR practice runner (scripts/ibkr-live.py) talks to the app here.
// POST { trades: [{ ts, symbol, side, qty, price }] } appends fills to the owner's trade log, which the
//   Autopilot screen already reads. Re-sending a fill is harmless (same ts+symbol+side is skipped).
// GET answers { enabled } from the owner's Autopilot switch, the runner's kill switch before it trades.
// Gated by WEBHOOK_SECRET like the other machine endpoints. The owner is IBKR_REPORT_USER_ID, one account
// on purpose: this is Joshua's own broker, not a multi-user feature. Unset means not configured, closed.
import { applyCors } from '../_cors.js';
import { verifyWebhookSecret } from '../_shared-secret.js';
import { getKv } from '../_kv.js';

const TRADE_LOG_LIMIT = 100;
const SIDES = new Set(['buy', 'sell']);

export default async function handler(req, res) {
  applyCors(req, res, { methods: 'GET, POST, OPTIONS' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = verifyWebhookSecret(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const userId = process.env.IBKR_REPORT_USER_ID;
  if (!userId) return res.status(503).json({ error: 'IBKR report not configured' });
  const kv = await getKv();
  if (!kv) return res.status(503).json({ error: 'Storage unavailable' });

  if (req.method === 'GET') {
    const settings = await kv.get(`autopilot:${userId}`);
    return res.status(200).json({ ok: true, enabled: Boolean(settings?.enabled) });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const incoming = (Array.isArray(body?.trades) ? body.trades : [])
    .filter((t) => t && typeof t.symbol === 'string' && SIDES.has(t.side) && Number(t.qty) > 0 && typeof t.ts === 'string')
    .map((t) => ({ ts: t.ts, symbol: t.symbol.toUpperCase().slice(0, 12), side: t.side, qty: Number(t.qty), price: Number(t.price) || 0, mode: 'paper', broker: 'ibkr' }));
  const log = (await kv.get(`trades:${userId}`)) || [];
  const seen = new Set(log.map((t) => `${t.ts}|${t.symbol}|${t.side}`));
  const fresh = incoming.filter((t) => !seen.has(`${t.ts}|${t.symbol}|${t.side}`));
  if (fresh.length) await kv.set(`trades:${userId}`, [...fresh, ...log].slice(0, TRADE_LOG_LIMIT));
  return res.status(200).json({ ok: true, added: fresh.length });
}
