import crypto from 'crypto';

// Shared secret check for the TradingView webhooks. Fails CLOSED: an unset
// WEBHOOK_SECRET means "not configured", never "let everyone in" — these
// endpoints place broker orders.
export function verifyWebhookSecret(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return { ok: false, status: 503, error: 'Webhook not configured' };

  const provided = req.headers['x-webhook-secret'];
  if (typeof provided !== 'string') return { ok: false, status: 401, error: 'Unauthorized' };

  const expected = Buffer.from(secret);
  const given = Buffer.from(provided);
  const valid = expected.length === given.length && crypto.timingSafeEqual(given, expected);
  return valid ? { ok: true } : { ok: false, status: 401, error: 'Unauthorized' };
}
