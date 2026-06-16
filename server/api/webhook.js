import { applyCors } from './_cors.js';
import { getKv } from './_kv.js';
import crypto from 'crypto';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  const kv = await getKv();
  applyCors(req, res, {
    methods: 'GET, POST, OPTIONS',
    headers: 'Content-Type, X-Webhook-Secret',
  });

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — generate or return webhook URL for a Pro user
  if (req.method === 'GET') {
    const { action, customerId } = req.query;
    if (action !== 'generate') return res.status(400).json({ error: 'Missing action=generate' });
    if (!customerId) return res.status(400).json({ error: 'Missing customerId' });

    // Pro gate
    try {
      const sub = await kv.get(`sub:${customerId}`);
      if (!sub || sub.status !== 'active') {
        return res.status(403).json({ error: 'Pro subscription required', tier: 'free' });
      }
    } catch (err) {
      console.error('[WEBHOOK] KV sub check failed:', err.message);
      return res.status(500).json({ error: 'Subscription check failed' });
    }

    // Check for existing key, or generate new
    let webhookKey = await kv.get(`webhook_key:${customerId}`).catch(() => null);
    if (!webhookKey) {
      webhookKey = crypto.randomUUID();
      await kv.set(`webhook_key:${customerId}`, webhookKey);
      await kv.set(`webhook:${webhookKey}`, customerId);
      console.log('[WEBHOOK] Generated key for user:', customerId);
    }

    const baseUrl = `https://${req.headers.host}`;
    return res.status(200).json({
      key: webhookKey,
      url: `${baseUrl}/api/webhook?key=${webhookKey}`,
    });
  }

  // POST — receive TradingView alert
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key } = req.query;
  const webhookSecret = process.env.WEBHOOK_SECRET;

  // Auth: validate per-user key OR global secret header
  const providedSecret = req.headers['x-webhook-secret'];
  let userId = 'anonymous';

  if (key) {
    const resolved = await kv.get(`webhook:${key}`).catch(() => null);
    if (!resolved) {
      console.log('[WEBHOOK] Invalid key:', key);
      return res.status(401).json({ error: 'Invalid webhook key' });
    }
    userId = resolved;
    console.log('[WEBHOOK] Authenticated user:', userId);
  } else if (webhookSecret && providedSecret) {
    const expected = Buffer.from(webhookSecret);
    const provided = Buffer.from(providedSecret);
    const valid = expected.length === provided.length && crypto.timingSafeEqual(provided, expected);
    if (valid) {
      userId = 'global';
    } else {
      return res.status(401).json({ error: 'Unauthorized: invalid secret' });
    }
  } else if (webhookSecret) {
    return res.status(401).json({ error: 'Unauthorized: invalid secret' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }

  // TradingView alert format: { ticker, action, price, qty, comment, strategy }
  const { ticker, action, price, qty, comment, strategy } = body || {};

  if (!ticker || !action) {
    return res.status(400).json({ error: 'Missing required fields: ticker, action' });
  }

  const normalizedAction = action.toLowerCase();
  if (!['buy', 'sell', 'close'].includes(normalizedAction)) {
    return res.status(400).json({ error: 'Invalid action. Must be: buy, sell, close' });
  }

  const signal = {
    id: crypto.randomUUID(),
    ticker: ticker.toUpperCase(),
    action: normalizedAction,
    price: price != null ? parseFloat(price) : null,
    qty: qty != null ? parseFloat(qty) : null,
    comment: comment || null,
    strategy: strategy || 'TradingView',
    source: 'tradingview_webhook',
    receivedAt: new Date().toISOString(),
  };

  console.log('[WEBHOOK] Signal received:', JSON.stringify(signal));

  // Store in KV: signals:<userId> — keep last 100
  try {
    const existing = await kv.get(`signals:${userId}`) || [];
    const updated = [signal, ...existing].slice(0, 100);
    await kv.set(`signals:${userId}`, updated, { ex: 60 * 60 * 24 * 7 }); // 7d TTL
    console.log('[WEBHOOK] Stored signal for user:', userId);
  } catch (err) {
    console.error('[WEBHOOK] KV write failed:', err.message);
    // Non-fatal: still return 200 so TradingView doesn't retry
  }

  return res.status(200).json({ ok: true, signal, message: 'Signal received' });
}
