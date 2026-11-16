// POST /api/iap { transactionId } or { appTransactionId } -- claim an App Store purchase for the signed-in user.
//
// The client never proves anything itself: we ask Apple's App Store Server API for the transaction by id,
// which comes back signed by Apple over TLS, so a forged id just 404s.
// - transactionId: a Pro subscription (monthly/yearly) or the old lifetime "premium" item.
// - appTransactionId: the app download itself. Bought before EPIPHANY_FREE_SINCE = paid $1 = Pro for life.
// ponytail: no Server Notifications endpoint (it needs x5c chain checks); an expired sub is re-asked
// from Apple on the next gate check instead (refreshAppleSub).
import { getKv } from './_kv.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';
import { bump } from './event.js';

const BUNDLE_ID = 'com.heyitsmejosh.epiphany';
const LIFETIME_IDS = new Set(['com.heyitsmejosh.epiphany.premium']);
const SUB_IDS = new Set(['com.heyitsmejosh.epiphany.pro.monthly', 'com.heyitsmejosh.epiphany.pro.yearly']);
const HOSTS = ['https://api.storekit.itunes.apple.com', 'https://api.storekit-sandbox.itunes.apple.com'];

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlJson = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));
const decodeJwsPayload = (jws) => {
  const p = jws.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(p.padEnd(Math.ceil(p.length / 4) * 4, '=')));
};

async function appStoreJwt() {
  const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY } = process.env;
  if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_PRIVATE_KEY) throw new Error('ASC_* secrets missing');
  const pem = ASC_PRIVATE_KEY.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64urlJson({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' })}.${b64urlJson({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1', bid: BUNDLE_ID })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(input));
  return `${input}.${b64url(sig)}`;
}

// Production first; Apple says to retry sandbox on 404 so TestFlight/review purchases work.
async function appleGet(path) {
  const jwt = await appStoreJwt();
  for (const host of HOSTS) {
    const res = await fetch(`${host}${path}`, { headers: { Authorization: `Bearer ${jwt}` } });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`App Store Server API ${res.status}`);
    return res.json();
  }
  return null;
}

async function fetchTransaction(id) {
  const body = await appleGet(`/inApps/v1/transactions/${encodeURIComponent(id)}`);
  return body?.signedTransactionInfo ? decodeJwsPayload(body.signedTransactionInfo) : null;
}

async function fetchAppTransaction(id) {
  const body = await appleGet(`/inApps/v1/transactions/appTransactions/${encodeURIComponent(id)}`);
  return body?.signedAppTransactionInfo ? decodeJwsPayload(body.signedAppTransactionInfo) : null;
}

// Apple subscription status: 1 active, 4 billing grace period. 2 expired, 3 billing retry, 5 revoked.
const APPLE_LIVE = new Set([1, 4]);
const RECHECK_MS = 60 * 60 * 1000;

// Called by the gate once appleExpiresAt has passed: ask Apple whether it renewed, at most hourly.
export async function refreshAppleSub(kv, email, user) {
  if (Date.now() - Date.parse(user.appleCheckedAt || 0) < RECHECK_MS) return false;
  try {
    const body = await appleGet(`/inApps/v1/subscriptions/${encodeURIComponent(user.appleOriginalTransactionId)}`);
    const last = (body?.data || []).flatMap((g) => g.lastTransactions || [])
      .find((t) => String(t.originalTransactionId) === String(user.appleOriginalTransactionId));
    const tx = last?.signedTransactionInfo ? decodeJwsPayload(last.signedTransactionInfo) : null;
    const live = APPLE_LIVE.has(last?.status);
    const appleExpiresAt = tx?.expiresDate ? new Date(tx.expiresDate).toISOString() : user.appleExpiresAt;
    await kv.set(`user:${email}`, { ...user, appleExpiresAt, appleStatus: last?.status ?? null, appleCheckedAt: new Date().toISOString() });
    return live;
  } catch (err) {
    console.error('[IAP] refresh failed:', err.message);
    return false;
  }
}

const idOk = (v) => /^\d{1,30}$/.test(v);

export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');
  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Unauthorized');
  const transactionId = String(req.body?.transactionId || '').trim();
  const appTransactionId = String(req.body?.appTransactionId || '').trim();
  if (!idOk(transactionId) && !idOk(appTransactionId)) return errorResponse(res, 400, 'transactionId required');

  // Work out what Apple says this is, then which fields it puts on the account.
  let ownerKey, patch, event = null;
  try {
    if (idOk(transactionId)) {
      const tx = await fetchTransaction(transactionId);
      const known = tx && tx.bundleId === BUNDLE_ID && (LIFETIME_IDS.has(tx.productId) || SUB_IDS.has(tx.productId));
      if (!known || tx.revocationDate || !idOk(String(tx.originalTransactionId ?? ''))) return errorResponse(res, 402, 'Purchase not valid');
      ownerKey = `iap:${tx.originalTransactionId}`;
      if (LIFETIME_IDS.has(tx.productId)) {
        patch = { tier: 'premium', appleOriginalTransactionId: tx.originalTransactionId };
      } else {
        if (!(tx.expiresDate > Date.now())) return errorResponse(res, 402, 'Subscription expired');
        patch = { appleOriginalTransactionId: tx.originalTransactionId, appleProductId: tx.productId, appleExpiresAt: new Date(tx.expiresDate).toISOString(), appleCheckedAt: new Date().toISOString() };
        // offerDiscountType FREE_TRIAL = the 7-day trial; the first paid period is a subscription.
        event = tx.offerDiscountType === 'FREE_TRIAL' ? 'trial_started' : 'subscribed';
      }
    } else {
      const app = await fetchAppTransaction(appTransactionId);
      if (!app || app.bundleId !== BUNDLE_ID || !idOk(String(app.appTransactionId ?? ''))) return errorResponse(res, 402, 'Purchase not valid');
      const since = Date.parse(process.env.EPIPHANY_FREE_SINCE || '');
      if (!Number.isNaN(since) && !(app.originalPurchaseDate < since)) return errorResponse(res, 402, 'Downloaded after Epiphany went free');
      ownerKey = `iapapp:${app.appTransactionId}`;
      patch = { tier: 'premium', appleAppTransactionId: app.appTransactionId };
    }
  } catch (err) {
    console.error('[IAP]', err.message);
    return errorResponse(res, 502, 'Could not verify purchase with Apple');
  }

  const email = session.email;
  try {
    const kv = await getKv();
    if (!kv) throw new Error('Purchase storage unavailable');
    // Reserve ownership atomically so concurrent claims cannot upgrade two accounts.
    // Keep the reservation if the account write fails: the same owner can retry.
    const claimed = await kv.setStrict(ownerKey, email, { nx: true });
    if (claimed !== 'OK') {
      const owner = await kv.getStrict(ownerKey);
      if (!owner) throw new Error('Purchase owner could not be confirmed');
      if (owner !== email) return errorResponse(res, 409, 'Purchase already claimed by another account');
    }
    const user = (await kv.getStrict(`user:${email}`)) || { email };
    // A repeat claim (every launch re-posts) is not a new trial or subscription.
    const isNew = event && user.appleOriginalTransactionId !== patch.appleOriginalTransactionId;
    await kv.setStrict(`user:${email}`, { ...user, ...patch, premiumSince: user.premiumSince || new Date().toISOString() });
    if (isNew) await bump(kv, event);
    return res.status(200).json({ ok: true, tier: 'premium', expiresAt: patch.appleExpiresAt || null });
  } catch (err) {
    console.error('[IAP] Account upgrade failed:', err.message);
    return errorResponse(res, 503, 'Purchase verified, but the account could not be upgraded. Restore the purchase to retry.');
  }
}
