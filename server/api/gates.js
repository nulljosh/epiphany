import { getKv } from './_kv.js';
import { refreshAppleSub } from './iap.js';

// Read at call time: on the Worker, secrets land in process.env per request, not at import.
function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);
}

// The tier the client should show: admin accounts are comped Pro, everyone else is what their record says.
export function effectiveTier(email, tier) {
  return isAdmin(email) ? 'pro' : (tier || 'free');
}

export function isAdmin(email) {
  return adminEmails().includes(email);
}

// EPIPHANY_FREE_SINCE is the moment the App Store price went to $0 (ISO date). Before it the
// apps were a $1 full unlock; anyone who bought before it keeps Pro for life.
export function paidAppEra(now = Date.now()) {
  const since = Date.parse(process.env.EPIPHANY_FREE_SINCE || '');
  return Number.isNaN(since) || now < since;
}

// URLSession's default User-Agent ("Epiphany/2.5 CFNetwork/... Darwin/...") tells the apps from a
// browser, which always says Mozilla. A header the app sets itself also counts.
export function isNativeClient(req) {
  const h = req?.headers || {};
  if (/^(ios|macos|watchos)$/i.test(String(h['x-epiphany-client'] || ''))) return true;
  const ua = String(h['user-agent'] || '');
  return /CFNetwork/.test(ua) && !/Mozilla/.test(ua);
}

// Stripe statuses that still mean "paying" (a trial is Pro; past_due keeps Pro while Stripe retries).
const STRIPE_LIVE = new Set(['active', 'trialing', 'past_due']);

// Pro is: admin, a lifetime unlock ($1 web purchase, $1 App Store app, comp), or a live subscription
// (Stripe on web, App Store in the apps). Everything lives on KV records so the autopilot cron, which
// has no request, resolves the same way.
export async function isProByEmail(email, req) {
  if (!email) return false;
  if (isAdmin(email)) return true;
  // Escape hatch only: EPIPHANY_REQUIRE_PRO=false opens every gate again.
  if (process.env.EPIPHANY_REQUIRE_PRO === 'false') return true;

  const kv = await getKv();
  if (!kv) return false;
  const user = await kv.get(`user:${email}`);
  if (!user) return false;

  // While the app still costs $1, the app itself is the receipt. The mark it leaves is lifetime Pro.
  // ponytail: a script can fake the User-Agent until EPIPHANY_FREE_SINCE; after it no new marks are made.
  if (req && isNativeClient(req) && paidAppEra()) {
    if (!user.nativeApp) {
      try { await kv.set(`user:${email}`, { ...user, nativeApp: true }); } catch { /* the mark is a convenience */ }
    }
    return true;
  }
  if (user.nativeApp) return true;
  if (user.tier === 'pro' || user.tier === 'premium') return true;

  if (user.appleOriginalTransactionId && user.appleExpiresAt) {
    if (Date.parse(user.appleExpiresAt) > Date.now()) return true;
    if (await refreshAppleSub(kv, email, user)) return true;
  }

  if (!user.stripe_customer_id) return false;
  const sub = await kv.get(`sub:${user.stripe_customer_id}`);
  if (!sub) return false;
  // The old $1 one-time purchase has no subscription id: it is for life.
  if (!sub.subscriptionId) return sub.status === 'active';
  return STRIPE_LIVE.has(sub.status);
}

export async function isPro(session, req) {
  return isProByEmail(session?.email, req);
}
