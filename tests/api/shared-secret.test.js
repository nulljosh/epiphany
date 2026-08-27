import { describe, it, expect, afterEach } from 'vitest';
import { verifyWebhookSecret, verifyCronSecret } from '../../server/api/_shared-secret.js';

const hookReq = (v) => ({ headers: v === undefined ? {} : { 'x-webhook-secret': v } });
const cronReq = (v) => ({ headers: v === undefined ? {} : { authorization: v } });

afterEach(() => {
  delete process.env.WEBHOOK_SECRET;
  delete process.env.CRON_SECRET;
});

describe('verifyWebhookSecret', () => {
  it('fails closed when no secret is configured', () => {
    expect(verifyWebhookSecret(hookReq('anything'))).toMatchObject({ ok: false, status: 503 });
  });

  it('rejects a missing header', () => {
    process.env.WEBHOOK_SECRET = 'topsecret';
    expect(verifyWebhookSecret(hookReq())).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects a wrong secret, including a length-mismatched one', () => {
    process.env.WEBHOOK_SECRET = 'topsecret';
    expect(verifyWebhookSecret(hookReq('nope')).ok).toBe(false);
    expect(verifyWebhookSecret(hookReq('topsecretX')).ok).toBe(false);
  });

  it('accepts the right secret', () => {
    process.env.WEBHOOK_SECRET = 'topsecret';
    expect(verifyWebhookSecret(hookReq('topsecret'))).toEqual({ ok: true });
  });
});

describe('verifyCronSecret', () => {
  // The case that mattered: these routes used to skip the check entirely when
  // CRON_SECRET was unset, leaving autopilot trading open to anyone.
  it('fails closed when no secret is configured', () => {
    expect(verifyCronSecret(cronReq('Bearer anything'))).toMatchObject({ ok: false, status: 503 });
  });

  it('rejects a missing or wrong Authorization header', () => {
    process.env.CRON_SECRET = 'cronsecret';
    expect(verifyCronSecret(cronReq()).ok).toBe(false);
    expect(verifyCronSecret(cronReq('cronsecret')).ok).toBe(false); // no Bearer prefix
    expect(verifyCronSecret(cronReq('Bearer wrong')).ok).toBe(false);
  });

  it('accepts a correct Bearer token', () => {
    process.env.CRON_SECRET = 'cronsecret';
    expect(verifyCronSecret(cronReq('Bearer cronsecret'))).toEqual({ ok: true });
  });
});
