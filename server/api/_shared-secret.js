import crypto from 'crypto';

function compare(expected, provided) {
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(b, a);
}

// Shared-secret checks for the endpoints no session ever reaches: TradingView
// webhooks and cron triggers. Both fail CLOSED — an unset secret means "not
// configured", never "let everyone in". These endpoints place broker orders.
export function verifyWebhookSecret(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return { ok: false, status: 503, error: 'Webhook not configured' };
  return compare(secret, req.headers['x-webhook-secret'])
    ? { ok: true }
    : { ok: false, status: 401, error: 'Unauthorized' };
}

export function verifyCronSecret(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, status: 503, error: 'Cron not configured' };
  return compare(`Bearer ${secret}`, req.headers.authorization)
    ? { ok: true }
    : { ok: false, status: 401, error: 'Unauthorized' };
}
