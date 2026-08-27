// Verifies Apple "Sign in with Apple" identity tokens.
//
// Apple signs these RS256 with the keys published at appleid.apple.com/auth/keys.
// Decoding the payload without checking that signature lets anyone forge any
// `sub`/`email` and log in as any user, so every field below is checked.
// ponytail: WebCrypto instead of a JWT dependency — Workers and Node 18+ both have it.

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const JWKS_TTL = 24 * 60 * 60; // Apple rotates rarely; a day is well inside their guidance.

const b64urlToString = (s) => new TextDecoder().decode(b64urlToBytes(s));

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function fetchJwks(kv) {
  const cached = kv && (await kv.get('apple:jwks'));
  if (cached?.keys?.length) return cached;

  const res = await fetch(APPLE_JWKS_URL);
  if (!res.ok) throw new Error(`Apple JWKS fetch failed: HTTP ${res.status}`);
  const jwks = await res.json();
  if (!jwks?.keys?.length) throw new Error('Apple JWKS empty');
  if (kv) await kv.set('apple:jwks', jwks, { ex: JWKS_TTL });
  return jwks;
}

/**
 * Verify an Apple identity token and return its payload.
 * Throws on any failure — callers must treat a throw as "not authenticated".
 *
 * @param {string} token      the raw identity token
 * @param {string[]} audiences bundle IDs / Services IDs allowed to have requested it
 * @param {object|null} kv    optional KV handle, used only to cache Apple's JWKS
 */
export async function verifyAppleIdentityToken(token, audiences, kv = null) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [rawHeader, rawPayload, rawSignature] = parts;

  const header = JSON.parse(b64urlToString(rawHeader));
  if (header.alg !== 'RS256') throw new Error(`Unexpected token alg: ${header.alg}`);
  if (!header.kid) throw new Error('Token has no key id');

  let jwks = await fetchJwks(kv);
  let jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk && kv) {
    // Unknown kid usually means Apple rotated; drop the cache and retry once.
    await kv.del('apple:jwks');
    jwks = await fetchJwks(kv);
    jwk = jwks.keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error('No Apple key matches token kid');

  const key = await globalThis.crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const ok = await globalThis.crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(rawSignature),
    new TextEncoder().encode(`${rawHeader}.${rawPayload}`),
  );
  if (!ok) throw new Error('Token signature does not verify');

  const payload = JSON.parse(b64urlToString(rawPayload));

  if (payload.iss !== APPLE_ISSUER) throw new Error(`Unexpected issuer: ${payload.iss}`);

  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.some((a) => audiences.includes(a))) throw new Error(`Unexpected audience: ${aud.join(',')}`);

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw new Error('Token expired');
  if (typeof payload.iat === 'number' && payload.iat > now + 300) throw new Error('Token issued in the future');

  if (!payload.sub) throw new Error('Token has no subject');

  return payload;
}
