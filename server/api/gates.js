import { getKv } from './_kv.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);

export function isAdmin(email) {
  return ADMIN_EMAILS.includes(email);
}

// Email variant for contexts without a session (e.g. the autopilot cron).
export async function isProByEmail(email) {
  if (!email) return false;
  if (isAdmin(email)) return true;

  const kv = await getKv();
  if (!kv) return false;

  const user = await kv.get(`user:${email}`);
  if (!user?.stripe_customer_id) return false;

  const sub = await kv.get(`sub:${user.stripe_customer_id}`);
  return sub?.status === 'active';
}

export async function isPro(session) {
  return isProByEmail(session?.email);
}
