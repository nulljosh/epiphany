// POST /api/iap { transactionId } -- claim an App Store purchase for the signed-in user.
//
// The client never proves anything itself: we ask Apple's App Store Server API for the
// transaction by id, which comes back signed by Apple over TLS, so a forged id just 404s.
// ponytail: one non-consumable ("premium"), so a verified transaction sets user.tier and
// that's it. Subscriptions would need renewal/expiry handling via server notifications.
import { getKv } from './_kv.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';

const BUNDLE_ID = 'com.heyitsmejosh.epiphany';
const PRODUCT_IDS = new Set(['com.heyitsmejosh.epiphany.premium']);

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
async function fetchTransaction(transactionId) {
  const jwt = await appStoreJwt();
  for (const host of ['https://api.storekit.itunes.apple.com', 'https://api.storekit-sandbox.itunes.apple.com']) {
    const res = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, { headers: { Authorization: `Bearer ${jwt}` } });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`App Store Server API ${res.status}`);
    const { signedTransactionInfo } = await res.json();
    return decodeJwsPayload(signedTransactionInfo);
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');
  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Unauthorized');
  const transactionId = String(req.body?.transactionId || '').trim();
  if (!/^\d{1,30}$/.test(transactionId)) return errorResponse(res, 400, 'transactionId required');

  let tx;
  try { tx = await fetchTransaction(transactionId); } catch (err) {
    console.error('[IAP]', err.message);
    return errorResponse(res, 502, 'Could not verify purchase with Apple');
  }
  if (!tx || tx.bundleId !== BUNDLE_ID || !PRODUCT_IDS.has(tx.productId) || tx.revocationDate) {
    return errorResponse(res, 402, 'Purchase not valid');
  }

  const kv = await getKv();
  const email = session.email;
  const owner = await kv.get(`iap:${tx.originalTransactionId}`);
  if (owner && owner !== email) return errorResponse(res, 409, 'Purchase already claimed by another account');

  const user = (await kv.get(`user:${email}`)) || { email };
  await kv.set(`user:${email}`, { ...user, tier: 'premium', appleOriginalTransactionId: tx.originalTransactionId, premiumSince: user.premiumSince || new Date().toISOString() });
  await kv.set(`iap:${tx.originalTransactionId}`, email);
  return res.status(200).json({ ok: true, tier: 'premium' });
}
