import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const session = { value: { email: 'a@b.c' } };
vi.mock('../../server/api/auth-helpers.js', () => ({
  getSessionUser: vi.fn(() => Promise.resolve(session.value)),
  errorResponse: (res, status, message) => res.status(status).json({ error: message }),
}));
const store = new Map();
vi.mock('../../server/api/_kv.js', () => ({
  getKv: vi.fn().mockResolvedValue({
    getStrict: vi.fn((k) => Promise.resolve(store.get(k) ?? null)),
    setStrict: vi.fn((k, v, options) => {
      if (options?.nx && store.has(k)) return Promise.resolve(null);
      store.set(k, v); return Promise.resolve('OK');
    }),
  }),
}));

const { getKv } = await import('../../server/api/_kv.js');
const { default: handler } = await import('../../server/api/iap.js');
const res = () => { const r = { status: vi.fn(() => r), json: vi.fn(() => r) }; return r; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const signedTx = (p) => `${b64({ alg: 'ES256' })}.${b64(p)}.sig`;

describe('POST /api/iap', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    session.value = { email: 'a@b.c' };
    process.env.ASC_KEY_ID = 'K'; process.env.ASC_ISSUER_ID = 'I';
    // throwaway P-256 key just so the JWT signer has something to import
    process.env.ASC_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgevZzL1gdAFr88hb2\nOF/2NxApJCzGCEDdfSp6VQO30hyhRANCAAQRWz+jn65BtOMvdyHKcvjBeBSDZH2r\n1RTwjmYSi9R/zpBnuQ4EiMnCqfMPWiZqB4QdbAd0E7oH50VpuZ1P087G\n-----END PRIVATE KEY-----';
  });

  it('rejects bad ids and missing sessions', async () => {
    let r = res(); await handler({ method: 'POST', body: { transactionId: 'abc' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    session.value = null; r = res(); await handler({ method: 'POST', body: { transactionId: '1' } }, r);
    expect(r.status).toHaveBeenCalledWith(401); session.value = { email: 'a@b.c' };
  });

  it('upgrades the account when Apple confirms the transaction', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({
      signedTransactionInfo: signedTx({ bundleId: 'com.heyitsmejosh.epiphany', productId: 'com.heyitsmejosh.epiphany.premium', originalTransactionId: '99' }),
    }) })));
    const r = res(); await handler({ method: 'POST', body: { transactionId: '123' } }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(store.get('user:a@b.c').tier).toBe('premium');
    expect(store.get('iap:99')).toBe('a@b.c');
  });

  it('refuses a transaction already claimed by another account, or the wrong product', async () => {
    store.set('iap:99', 'x@y.z');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({
      signedTransactionInfo: signedTx({ bundleId: 'com.heyitsmejosh.epiphany', productId: 'com.heyitsmejosh.epiphany.premium', originalTransactionId: '99' }),
    }) })));
    let r = res(); await handler({ method: 'POST', body: { transactionId: '123' } }, r);
    expect(r.status).toHaveBeenCalledWith(409);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({
      signedTransactionInfo: signedTx({ bundleId: 'com.other', productId: 'x', originalTransactionId: '1' }),
    }) })));
    r = res(); await handler({ method: 'POST', body: { transactionId: '5' } }, r);
    expect(r.status).toHaveBeenCalledWith(402);
  });

  const confirmPurchase = () => vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, status: 200, json: async () => ({ signedTransactionInfo: signedTx({
      bundleId: 'com.heyitsmejosh.epiphany', productId: 'com.heyitsmejosh.epiphany.premium', originalTransactionId: '99',
    }) }),
  })));

  it('does not report success when the account read fails; restore retries safely', async () => {
    confirmPurchase();
    const kv = await getKv();
    kv.getStrict.mockRejectedValueOnce(new Error('storage down'));
    let r = res(); await handler({ method: 'POST', body: { transactionId: '123' } }, r);
    expect(r.status).toHaveBeenCalledWith(503);
    expect(store.has('user:a@b.c')).toBe(false);
    expect(store.get('iap:99')).toBe('a@b.c');
    r = res(); await handler({ method: 'POST', body: { transactionId: '123' } }, r);
    expect(r.status).toHaveBeenCalledWith(200);
  });

  it('does not acknowledge a failed account write', async () => {
    confirmPurchase();
    store.set('iap:99', 'a@b.c');
    const kv = await getKv();
    kv.setStrict.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('write failed'));
    const r = res(); await handler({ method: 'POST', body: { transactionId: '123' } }, r);
    expect(r.status).toHaveBeenCalledWith(503);
    expect(store.has('user:a@b.c')).toBe(false);
  });

  it('allows only one account to claim a purchase concurrently', async () => {
    confirmPurchase();
    const a = res(), b = res();
    const first = handler({ method: 'POST', body: { transactionId: '123' } }, a);
    session.value = { email: 'second@b.c' };
    const second = handler({ method: 'POST', body: { transactionId: '123' } }, b);
    await Promise.all([first, second]);
    const statuses = [a.status.mock.calls[0][0], b.status.mock.calls[0][0]].sort();
    expect(statuses).toEqual([200, 409]);
    expect([...store.keys()].filter(k => k.startsWith('user:'))).toHaveLength(1);
  });

});
