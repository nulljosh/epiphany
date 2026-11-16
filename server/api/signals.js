import { applyCors } from './_cors.js';
import { getKv } from './_kv.js';
import crypto from 'crypto';
import { getSessionUser } from './auth-helpers.js';
import { isProByEmail } from './gates.js';

export default async function handler(req, res) {
  const kv = await getKv();
  applyCors(req, res, {
    methods: 'GET, POST, OPTIONS',
    headers: 'Content-Type, X-Customer-Id',
  });

  if (req.method === 'OPTIONS') return res.status(200).end();

  // The caller's own account only. A customer id from the client used to be the whole check, so
  // anyone holding another Pro customer's id could read or post that customer's signals.
  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Sign in required' });
  if (!(await isProByEmail(session.email, req))) {
    return res.status(403).json({ error: 'Pro subscription required', tier: 'free' });
  }
  const user = await kv.get(`user:${session.email}`);
  const customerId = user?.stripe_customer_id;
  if (!customerId) return res.status(200).json({ signals: [] });

  const userId = customerId;

  // GET — return latest signals, optionally filtered by asset
  if (req.method === 'GET') {
    const { limit = '10', asset } = req.query;

    try {
      const signals = await kv.get(`signals:${userId}`) || [];
      const filtered = asset
        ? signals.filter(s => s.ticker === asset.toUpperCase())
        : signals;
      const sliced = filtered.slice(0, Math.min(parseInt(limit, 10), 100));
      console.log(`[SIGNAL] GET for ${userId}: ${sliced.length} signals`);
      return res.status(200).json({ signals: sliced, count: sliced.length });
    } catch (err) {
      console.error('[SIGNAL] GET failed:', err.message);
      return res.status(500).json({ error: 'Failed to fetch signals' });
    }
  }

  // POST — store signal from Rise frontend (manual or auto-send)
  if (req.method === 'POST') {
    const body = req.body || {};
    const { sym, entry, size, stop, target, action } = body;

    if (!sym || entry == null) {
      return res.status(400).json({ error: 'Missing required fields: sym, entry' });
    }
    const price = parseFloat(entry);
    if (!Number.isFinite(price) || price < 0 || price > 1e9) {
      return res.status(400).json({ error: 'Invalid entry price' });
    }

    const signal = {
      id: crypto.randomUUID(),
      ticker: sym.toUpperCase(),
      action: (action || 'buy').toLowerCase(),
      price,
      qty: size != null ? parseFloat(size) : null,
      stop: stop != null ? parseFloat(stop) : null,
      target: target != null ? parseFloat(target) : null,
      source: 'epiphany_frontend',
      sentAt: new Date().toISOString(),
    };

    try {
      const existing = await kv.get(`signals:${userId}`) || [];
      const updated = [signal, ...existing].slice(0, 100);
      await kv.set(`signals:${userId}`, updated, { ex: 60 * 60 * 24 * 7 }); // 7d TTL
      console.log('[SIGNAL] POST stored signal:', signal.id, 'for user:', userId);
      return res.status(200).json({ ok: true, signal });
    } catch (err) {
      console.error('[SIGNAL] POST failed:', err.message);
      return res.status(500).json({ error: 'Failed to store signal' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
