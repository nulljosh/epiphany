import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

// Mirrors the PKCE derivation in server/api/auth.js (action=twitter).
// RFC 7636: code_challenge = BASE64URL(SHA256(code_verifier)), no padding.
describe('twitter PKCE code_challenge', () => {
  it('matches RFC 7636 S256 test vector', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});
