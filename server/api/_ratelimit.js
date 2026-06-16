import { getKv } from './_kv.js';

const DEFAULT_WINDOW = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX = 30;

export async function checkRateLimit(req, { prefix = 'rl', window = DEFAULT_WINDOW, max = DEFAULT_MAX } = {}) {
  const kv = await getKv();
  if (!kv) return true;

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const key = `${prefix}:${ip}`;
  const entry = await kv.get(key);

  if (!entry || now - entry.firstAttempt > window) {
    await kv.set(key, { count: 1, firstAttempt: now }, { ex: Math.ceil(window / 1000) });
    return true;
  }

  if (entry.count >= max) return false;

  await kv.set(key, { count: entry.count + 1, firstAttempt: entry.firstAttempt }, { ex: Math.ceil(window / 1000) });
  return true;
}
