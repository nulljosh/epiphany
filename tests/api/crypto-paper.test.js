import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockKV, createReqRes, resetAllMocks } from './_mocks.js';

const kv = createMockKV();
vi.mock('../../server/api/_kv.js', () => ({ getKv: async () => kv }));
const { default: handler } = await import('../../server/api/broker/crypto-paper.js');

// 200 flat closes at 100, then today's price decides which side of the 100 day average BTC is on.
const yahoo = (price) => async () => ({ ok: true, json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: price }, indicators: { quote: [{ close: Array(200).fill(100) }] } }] } }) });

async function run(price, settings = {}) {
  vi.stubGlobal('fetch', yahoo(price));
  await kv.set('autopilot:users', ['u1']);
  await kv.set('autopilot:u1', { enabled: true, mode: 'paper', allowCrypto: true, ...settings });
  const { req, res } = createReqRes({ method: 'GET', headers: { authorization: 'Bearer cs' } });
  await handler(req, res);
  return res.data;
}

describe('crypto-paper', () => {
  beforeEach(() => { resetAllMocks(); process.env.CRON_SECRET = 'cs'; });
  afterEach(() => vi.unstubAllGlobals());

  it('above the 100 day average buys 10% of $10,000 once, never stacking', async () => {
    await run(200);
    await run(200);
    expect(await kv.get('paperpos:crypto:u1')).toEqual({ BTC: 5 }); // 1000 / 200
    expect(await kv.get('trades:u1')).toHaveLength(1);
  });

  it('falling below sells it all', async () => {
    await run(200);
    await run(50);
    expect(await kv.get('paperpos:crypto:u1')).toEqual({ BTC: 0 });
    expect((await kv.get('trades:u1'))[0]).toMatchObject({ side: 'sell', symbol: 'BTC', mode: 'paper' });
  });

  it('skips users who did not opt in to crypto, and never touches live mode', async () => {
    await run(200, { allowCrypto: false });
    await run(200, { mode: 'live' });
    expect(await kv.get('trades:u1')).toBeUndefined();
  });

  it('refuses a wrong secret', async () => {
    const { req, res } = createReqRes({ method: 'GET', headers: { authorization: 'Bearer nope' } });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});
