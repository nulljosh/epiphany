import { getKv } from './_kv.js';

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

// The iOS, Mac and Watch apps are a $1 App Store purchase that unlocks everything, and the server has
// no receipt for that. URLSession's default User-Agent ("Epiphany/2.5 CFNetwork/... Darwin/...") is how
// they are told apart from a browser, which always says Mozilla. A header the app sets itself also counts.
// ponytail: a script can fake this; that buys $1 of features, so no receipt check until it matters.
export function isNativeClient(req) {
  const h = req?.headers || {};
  if (/^(ios|macos|watchos)$/i.test(String(h['x-epiphany-client'] || ''))) return true;
  const ua = String(h['user-agent'] || '');
  return /CFNetwork/.test(ua) && !/Mozilla/.test(ua);
}

// Web gate: Free is the default, Premium is a Stripe purchase, the apps and admins are comped.
// `req` is the request being served; the autopilot cron has none, so it relies on the `nativeApp`
// mark left on the account the first time the app passed this gate.
export async function isProByEmail(email, req) {
  if (!email) return false;
  if (isAdmin(email)) return true;
  // Escape hatch only: EPIPHANY_REQUIRE_PRO=false opens every gate again.
  if (process.env.EPIPHANY_REQUIRE_PRO === 'false') return true;

  const kv = await getKv();
  if (!kv) return false;
  const user = await kv.get(`user:${email}`);

  if (req && isNativeClient(req)) {
    if (user && !user.nativeApp) {
      try { await kv.set(`user:${email}`, { ...user, nativeApp: true }); } catch { /* the mark is a convenience */ }
    }
    return true;
  }
  if (!req && user?.nativeApp) return true;

  // A paid `tier` on the account record grants Pro directly (comped/grandfathered
  // accounts have no Stripe customer). Stripe is the fallback path.
  if (user?.tier === 'pro' || user?.tier === 'premium') return true;
  if (!user?.stripe_customer_id) return false;

  const sub = await kv.get(`sub:${user.stripe_customer_id}`);
  return sub?.status === 'active';
}

export async function isPro(session, req) {
  return isProByEmail(session?.email, req);
}
