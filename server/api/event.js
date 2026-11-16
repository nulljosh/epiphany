// POST /api/event { name } -- count a funnel event. Daily counters only, no user id, no SDK.
// Read them with: kv get event:<name>:<YYYY-MM-DD>
import { getKv } from './_kv.js';

const CLIENT_EVENTS = new Set(['paywall_shown']);
// trial_started and subscribed are counted server-side when the store confirms them (iap, stripe-webhook).

export async function bump(kv, name) {
  try { await kv?.incr?.(`event:${name}:${new Date().toISOString().slice(0, 10)}`); } catch { /* counters never block a purchase */ }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const name = String(req.body?.name || '');
  if (!CLIENT_EVENTS.has(name)) return res.status(400).json({ error: 'Unknown event' });
  await bump(await getKv(), name);
  return res.status(204).end();
}
