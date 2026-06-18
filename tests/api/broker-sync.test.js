import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler from '../../server/api/broker/sync.js';
import { SnapTradeAdapter } from '../../src/utils/brokers/snaptrade.js';

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((d) => { res.body = d; return res; });
  return res;
}

describe('broker/sync stale-userSecret self-heal', () => {
  const saved = {};
  let kvStore;

  beforeEach(() => {
    vi.resetModules();
    saved.id = process.env.SNAPTRADE_CLIENT_ID;
    saved.key = process.env.SNAPTRADE_CONSUMER_KEY;
    process.env.SNAPTRADE_CLIENT_ID = 'client-1';
    process.env.SNAPTRADE_CONSUMER_KEY = 'secret-1';
    kvStore = new Map([['snaptrade:user:u1', { userSecret: 'stale-secret' }]]);
  });
  afterEach(() => {
    if (saved.id !== undefined) process.env.SNAPTRADE_CLIENT_ID = saved.id; else delete process.env.SNAPTRADE_CLIENT_ID;
    if (saved.key !== undefined) process.env.SNAPTRADE_CONSUMER_KEY = saved.key; else delete process.env.SNAPTRADE_CONSUMER_KEY;
    vi.doUnmock('../../server/api/_kv.js');
    vi.doUnmock('../../server/api/auth-helpers.js');
    vi.doUnmock('../../src/utils/brokers/snaptrade.js');
  });

  function mockKv() {
    vi.doMock('../../server/api/_kv.js', () => ({
      getKv: vi.fn(async () => ({
        get: vi.fn(async (k) => kvStore.get(k) ?? null),
        set: vi.fn(async (k, v) => { kvStore.set(k, v); }),
        del: vi.fn(async (k) => { kvStore.delete(k); }),
      })),
    }));
    vi.doMock('../../server/api/auth-helpers.js', () => ({
      getSessionUser: vi.fn(async () => ({ userId: 'u1', email: 'u1@example.com' })),
      errorResponse: (res, status, message) => res.status(status).json({ error: message }),
    }));
  }

  it('re-registers and retries once on a 1083 stale-secret error, then succeeds', async () => {
    let listAccountsCalls = 0;
    mockKv();
    vi.doMock('../../src/utils/brokers/snaptrade.js', () => ({
      SnapTradeAdapter: class {
        static isConfigured() { return true; }
        constructor() {}
        async registerUser() { return { userId: 'u1', userSecret: 'fresh-secret' }; }
        async listAccounts() {
          listAccountsCalls += 1;
          if (listAccountsCalls === 1) {
            throw new Error('[SnapTrade] GET /accounts failed: 401 {"detail":"Invalid userID or userSecret provided","code":"1083"}');
          }
          return [{ id: 'acct1' }];
        }
        async getHoldings() { return []; }
        async getBalance() { return { total: 0 }; }
        async getAccounts() { return [{ id: 'acct1' }]; }
        async listConnections() { return []; }
      },
    }));
    const { default: freshHandler } = await import('../../server/api/broker/sync.js');
    const res = mockRes();
    await freshHandler({ method: 'POST', body: {} }, res);

    expect(listAccountsCalls).toBe(2);
    expect(kvStore.get('snaptrade:user:u1')).toEqual({ userSecret: 'fresh-secret' });
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.linked).toBe(true);
  });

  it('does not re-register on an unrelated error', async () => {
    mockKv();
    vi.doMock('../../src/utils/brokers/snaptrade.js', () => ({
      SnapTradeAdapter: class {
        static isConfigured() { return true; }
        constructor() {}
        async registerUser() { throw new Error('should not be called'); }
        async listAccounts() { throw new Error('network timeout'); }
      },
    }));
    const { default: freshHandler } = await import('../../server/api/broker/sync.js');
    const res = mockRes();
    await freshHandler({ method: 'POST', body: {} }, res);

    expect(kvStore.get('snaptrade:user:u1')).toEqual({ userSecret: 'stale-secret' });
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toMatch(/network timeout/);
  });
});

describe('broker/sync', () => {
  const saved = {};
  beforeEach(() => {
    saved.id = process.env.SNAPTRADE_CLIENT_ID;
    saved.key = process.env.SNAPTRADE_CONSUMER_KEY;
    delete process.env.SNAPTRADE_CLIENT_ID;
    delete process.env.SNAPTRADE_CONSUMER_KEY;
  });
  afterEach(() => {
    if (saved.id !== undefined) process.env.SNAPTRADE_CLIENT_ID = saved.id;
    if (saved.key !== undefined) process.env.SNAPTRADE_CONSUMER_KEY = saved.key;
  });

  it('rejects non-POST', async () => {
    const res = mockRes();
    await handler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(405);
  });

  it('no-ops when SnapTrade is not configured', async () => {
    const res = mockRes();
    await handler({ method: 'POST', headers: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, skipped: true });
  });
});

describe('SnapTradeAdapter', () => {
  it('isConfigured reflects env presence', () => {
    const id = process.env.SNAPTRADE_CLIENT_ID;
    const key = process.env.SNAPTRADE_CONSUMER_KEY;
    delete process.env.SNAPTRADE_CLIENT_ID;
    delete process.env.SNAPTRADE_CONSUMER_KEY;
    expect(SnapTradeAdapter.isConfigured()).toBe(false);
    if (id !== undefined) process.env.SNAPTRADE_CLIENT_ID = id;
    if (key !== undefined) process.env.SNAPTRADE_CONSUMER_KEY = key;
  });

  it('placeOrder requires user credentials before any network call', async () => {
    const a = new SnapTradeAdapter({ clientId: 'x', consumerKey: 'y' });
    await expect(a.placeOrder({ accountId: 'acct', symbol: 'AAPL', side: 'buy', qty: 1 })).rejects.toThrow(/userId\/userSecret/);
  });

  it('signing is deterministic for the same input', () => {
    const a = new SnapTradeAdapter({ clientId: 'x', consumerKey: 'secret' });
    const s1 = a._sign('/api/v1/accounts', 'clientId=x&timestamp=1', null);
    const s2 = a._sign('/api/v1/accounts', 'clientId=x&timestamp=1', null);
    expect(s1).toBe(s2);
    expect(typeof s1).toBe('string');
  });
});
