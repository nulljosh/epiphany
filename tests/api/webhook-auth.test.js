import { describe, it, expect, afterEach } from 'vitest';
import { verifyWebhookSecret } from '../../server/api/_webhook-auth.js';

const req = (secret) => ({ headers: secret === undefined ? {} : { 'x-webhook-secret': secret } });

afterEach(() => { delete process.env.WEBHOOK_SECRET; });

describe('verifyWebhookSecret', () => {
  it('fails closed when no secret is configured', () => {
    expect(verifyWebhookSecret(req('anything'))).toMatchObject({ ok: false, status: 503 });
  });

  it('rejects a missing header', () => {
    process.env.WEBHOOK_SECRET = 'topsecret';
    expect(verifyWebhookSecret(req())).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects a wrong secret, including a length-mismatched one', () => {
    process.env.WEBHOOK_SECRET = 'topsecret';
    expect(verifyWebhookSecret(req('nope')).ok).toBe(false);
    expect(verifyWebhookSecret(req('topsecretX')).ok).toBe(false);
  });

  it('accepts the right secret', () => {
    process.env.WEBHOOK_SECRET = 'topsecret';
    expect(verifyWebhookSecret(req('topsecret'))).toEqual({ ok: true });
  });
});
