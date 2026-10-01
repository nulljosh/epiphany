import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockKV, createReqRes, resetAllMocks } from './_mocks.js';

const kv = createMockKV();
vi.mock('../../server/api/_kv.js', () => ({ getKv: async () => kv }));
vi.mock('../../server/api/gates.js', () => ({ isProByEmail: async () => true }));
const placeOrder = vi.fn(async () => ({ id: 'o1' }));
vi.mock('../../src/utils/brokers/snaptrade.js', () => ({
  SnapTradeAdapter: class {
    listAccounts = async () => [{ id: 'acct' }];
    getHoldings = async () => globalThis.__holdings || [];
    getBalance = async () => ({});
    placeOrder = placeOrder;
  },
}));

const { default: handler } = await import('../../server/api/broker/morning-run.js');

// 250 closes; the last one is what the price replaces. Above: ends high. Below: ends low.
const yahoo = (spyLast) => async (url) => {
  const sym = String(url).match(/chart\/([^?]+)/)[1];
  const series = sym === 'SPY' ? [...Array.from({ length: 249 }, (_, i) => 100 + i * 0.1), spyLast] : [50, 50, 50, 50, 50, 50];
  const price = sym === 'SPY' ? spyLast : sym === 'SSO' ? 90 : 20;
  return { ok: true, json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: price }, indicators: { quote: [{ close: series }] } }] } }) };
};

async function run(spyLast, { mode = 'paper', max = 500 } = {}) {
  vi.stubGlobal('fetch', yahoo(spyLast));
  await kv.set('autopilot:users', ['u1']);
  await kv.set('autopilot:u1', { enabled: true, mode, maxNotional: max, email: 'a@b.c' });
  await kv.set('snaptrade:user:u1', { userSecret: 's' });
  const { req, res } = createReqRes({ method: 'GET', query: { force: '1' }, headers: { authorization: 'Bearer cs' } });
  await handler(req, res);
  return res.data;
}

describe('morning-run Trend 2x', () => {
  beforeEach(() => {
    resetAllMocks();
    placeOrder.mockClear();
    globalThis.__holdings = [];
    process.env.CRON_SECRET = 'cs';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('paper: above the average buys SSO', async () => {
    const d = await run(200);
    expect(d.trend.target).toBe('SSO');
    expect(await kv.get('paperpos:u1')).toEqual({ SSO: 5 }); // floor(500 / 90)
  });

  it('paper: below the average switches to BIL and sells SSO', async () => {
    await kv.set('paperpos:u1', { SSO: 5 });
    const d = await run(50);
    expect(d.trend.target).toBe('BIL');
    expect(await kv.get('paperpos:u1')).toEqual({ SSO: 0, BIL: 25 });
  });

  it('paper: same side again does not stack', async () => {
    await run(200);
    await run(200);
    expect(await kv.get('paperpos:u1')).toEqual({ SSO: 5 });
  });

  it('live: per-trade cap is still $50, so SSO at $90 buys nothing', async () => {
    await run(200, { mode: 'live', max: 10000 });
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it('live: BIL at $20 buys floor(50 / 20) = 2 shares and counts fills', async () => {
    globalThis.__holdings = [{ symbol: 'SSO', shares: 0 }];
    await run(50, { mode: 'live', max: 10000 });
    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(placeOrder.mock.calls[0][0]).toMatchObject({ symbol: 'BIL', side: 'buy', qty: 2 });
    expect(await kv.get('autopilot:liveCount:u1')).toBe(1);
  });

  it('live: at the trade cap it reverts the user to paper', async () => {
    await kv.set('autopilot:liveCount:u1', 20);
    const d = await run(50, { mode: 'live' });
    expect(d.results[0].skipped).toMatch(/reverted to paper/);
    expect((await kv.get('autopilot:u1')).mode).toBe('paper');
    expect(placeOrder).not.toHaveBeenCalled();
  });
});
