import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
import { createMockKV, createReqRes, resetAllMocks } from './_mocks.js';

const kv = createMockKV();
vi.mock('../../server/api/_kv.js', () => ({ getKv: async () => kv }));
const { default: handler } = await import('../../server/api/broker/ibkr-report.js');

const call = async (method, body, secret = 'ws') => {
  const { req, res } = createReqRes({ method, body, headers: secret ? { 'x-webhook-secret': secret } : {} });
  await handler(req, res);
  return res;
};
const fill = { ts: '2026-10-01T10:27', symbol: 'eem', side: 'buy', qty: 14, price: 66.49 };

describe('ibkr-report', () => {
  beforeEach(() => {
    resetAllMocks();
    process.env.WEBHOOK_SECRET = 'ws';
    process.env.IBKR_REPORT_USER_ID = 'u1';
  });

  it('rejects a wrong secret and stays closed when unconfigured', async () => {
    expect((await call('POST', { trades: [fill] }, 'nope')).statusCode).toBe(401);
    delete process.env.IBKR_REPORT_USER_ID;
    expect((await call('POST', { trades: [fill] })).statusCode).toBe(503);
  });

  it('appends fills once, newest first, and skips junk', async () => {
    const bad = { symbol: 'X', side: 'hold', qty: 1, ts: 'a' };
    expect((await call('POST', { trades: [fill, bad] })).data.added).toBe(1);
    expect((await call('POST', { trades: [fill] })).data.added).toBe(0);
    expect(await kv.get('trades:u1')).toEqual([{ ...fill, symbol: 'EEM', mode: 'paper', broker: 'ibkr' }]);
  });

  it('GET is the kill switch: the Autopilot flag', async () => {
    expect((await call('GET')).data.enabled).toBe(false);
    await kv.set('autopilot:u1', { enabled: true });
    expect((await call('GET')).data.enabled).toBe(true);
  });
});
