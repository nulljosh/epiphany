// GET/POST /api/broker/autopilot — premium auto-trading enrollment + trade log.
// GET: settings + recent trades + pro flag (drives the UI lock state).
// POST: enable/disable, set per-trade cap. Premium only. Mode is forced to
// paper -- live order execution is disabled until it's been vetted further.
// Execution happens in broker/morning-run.js (hourly during market hours).
import { getKv } from '../_kv.js';
import { getSessionUser, errorResponse } from '../auth-helpers.js';
import { isPro } from '../gates.js';

const MAX_NOTIONAL_CAP = 100000;

export default async function handler(req, res) {
  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');

  const kv = await getKv();
  if (!kv) return res.status(503).json({ error: 'Storage unavailable' });

  const key = `autopilot:${session.userId}`;

  if (req.method === 'GET') {
    const [settings, trades, pro] = await Promise.all([
      kv.get(key),
      kv.get(`trades:${session.userId}`),
      isPro(session),
    ]);
    const sanitized = settings ? {
      enabled: settings.enabled,
      mode: settings.mode,
      maxNotional: settings.maxNotional,
      allocation: settings.allocation ?? 10,
      allowCrypto: settings.allowCrypto ?? false,
      allowOvernight: settings.allowOvernight ?? false,
    } : { enabled: false, mode: 'paper', maxNotional: 500, allocation: 10, allowCrypto: false, allowOvernight: false };
    return res.status(200).json({
      ok: true,
      pro,
      settings: sanitized,
      trades: trades || [],
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await isPro(session))) return errorResponse(res, 402, 'Premium required');

  const { enabled, maxNotional, allocation, allowCrypto, allowOvernight } = req.body || {};
  const cap = Number(maxNotional);
  const alloc = Number(allocation);
  const settings = {
    enabled: Boolean(enabled),
    mode: 'paper', // live execution disabled for now
    maxNotional: Number.isFinite(cap) && cap > 0 ? Math.min(cap, MAX_NOTIONAL_CAP) : 500,
    allocation: Number.isFinite(alloc) && alloc > 0 && alloc <= 100 ? alloc : 10, // % of portfolio
    allowCrypto: Boolean(allowCrypto),
    allowOvernight: Boolean(allowOvernight),
    email: session.email, // cron has no session; it gates on this
    updatedAt: new Date().toISOString(),
  };
  await kv.set(key, settings);

  const users = (await kv.get('autopilot:users')) || [];
  const next = settings.enabled
    ? [...new Set([...users, session.userId])]
    : users.filter((u) => u !== session.userId);
  await kv.set('autopilot:users', next);

  console.log(`[AUTOPILOT] ${session.userId}: enabled=${settings.enabled} mode=${settings.mode} cap=$${settings.maxNotional}`);
  return res.status(200).json({ ok: true, settings });
}
