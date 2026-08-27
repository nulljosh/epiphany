import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { verifyAppleIdentityToken } from '../../server/api/_apple-jwt.js';

const AUD = 'com.heyitsmejosh.epiphany';
const ISS = 'https://appleid.apple.com';
const KID = 'test-kid';

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let keyPair;
let jwks;

async function sign(payload, { kid = KID, alg = 'RS256' } = {}) {
  const header = b64url(JSON.stringify({ alg, kid }));
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyPair.privateKey,
    new TextEncoder().encode(`${header}.${body}`),
  );
  return `${header}.${body}.${b64url(new Uint8Array(sig))}`;
}

const validPayload = (over = {}) => ({
  iss: ISS,
  aud: AUD,
  sub: '000123.abc.456',
  email: 'real@example.com',
  email_verified: 'true',
  exp: Math.floor(Date.now() / 1000) + 600,
  iat: Math.floor(Date.now() / 1000) - 10,
  ...over,
});

beforeAll(async () => {
  keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const pub = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  jwks = { keys: [{ kty: pub.kty, n: pub.n, e: pub.e, kid: KID, alg: 'RS256', use: 'sig' }] };
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => jwks }));
});

afterEach(() => vi.clearAllMocks());

describe('verifyAppleIdentityToken', () => {
  it('accepts a token Apple actually signed', async () => {
    const payload = await verifyAppleIdentityToken(await sign(validPayload()), [AUD]);
    expect(payload.sub).toBe('000123.abc.456');
    expect(payload.email).toBe('real@example.com');
  });

  // The bug this file exists for: a forged token with no real signature used to
  // mint a session for any email the caller named.
  it('rejects a forged token with a garbage signature', async () => {
    const [h, p] = (await sign(validPayload())).split('.');
    await expect(verifyAppleIdentityToken(`${h}.${p}.bm90YXNpZ25hdHVyZQ`, [AUD])).rejects.toThrow(
      /signature/i,
    );
  });

  it('rejects an unsigned "alg: none" token', async () => {
    const h = b64url(JSON.stringify({ alg: 'none', kid: KID }));
    const p = b64url(JSON.stringify(validPayload()));
    await expect(verifyAppleIdentityToken(`${h}.${p}.`, [AUD])).rejects.toThrow(/alg/i);
  });

  it('rejects a token minted for another app', async () => {
    await expect(
      verifyAppleIdentityToken(await sign(validPayload({ aud: 'com.someone.else' })), [AUD]),
    ).rejects.toThrow(/audience/i);
  });

  it('rejects a token from another issuer', async () => {
    await expect(
      verifyAppleIdentityToken(await sign(validPayload({ iss: 'https://evil.example' })), [AUD]),
    ).rejects.toThrow(/issuer/i);
  });

  it('rejects an expired token', async () => {
    await expect(
      verifyAppleIdentityToken(await sign(validPayload({ exp: Math.floor(Date.now() / 1000) - 60 })), [AUD]),
    ).rejects.toThrow(/expired/i);
  });

  it('rejects a token whose kid is not in Apple\'s key set', async () => {
    await expect(verifyAppleIdentityToken(await sign(validPayload(), { kid: 'nope' }), [AUD])).rejects.toThrow(
      /kid/i,
    );
  });

  it('rejects a malformed token', async () => {
    await expect(verifyAppleIdentityToken('a.b', [AUD])).rejects.toThrow(/format/i);
  });
});
