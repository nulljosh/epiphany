import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler from '../../server/api/broker/sync.js';
import { SnapTradeAdapter } from '../../src/utils/brokers/snaptrade.js';

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((d) => { res.body = d; return res; });
  return res;
}

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
