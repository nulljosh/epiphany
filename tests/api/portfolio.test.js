import { describe, expect, it, vi } from 'vitest';
import { createReqRes } from './_mocks.js';

const store = new Map();
vi.mock('../../server/api/_kv.js', () => ({
  getKv: async () => ({ get: async (k) => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); } }),
}));
vi.mock('../../server/api/_ratelimit.js', () => ({ checkRateLimit: async () => true }));
vi.mock('../../server/api/auth-helpers.js', () => ({
  getSessionUser: async () => ({ userId: 'u1', email: 'u@example.com' }),
  errorResponse: (res, status, message) => res.status(status).json({ error: message }),
}));

const { default: handler } = await import('../../server/api/portfolio.js');

describe('portfolio save', () => {
  it('keeps bills, subscriptions, telecom and credits that a client did not send', async () => {
    store.set('portfolio:u1', {
      subscriptions: [{ name: 'iCloud+' }], bills: [{ name: 'Bell' }], credits: [{ name: 'GST' }],
      telecom: { account: 'x' }, goals: [{ name: 'Car' }],
    });
    const { req, res } = createReqRes({ method: 'POST', action: 'update', body: { holdings: [{ symbol: 'SPY', shares: 1 }] } });
    await handler(req, res);
    const saved = store.get('portfolio:u1');
    expect(saved.subscriptions).toEqual([{ name: 'iCloud+' }]);
    expect(saved.bills).toEqual([{ name: 'Bell' }]);
    expect(saved.credits).toEqual([{ name: 'GST' }]);
    expect(saved.telecom).toEqual({ account: 'x' });
    expect(saved.holdings).toEqual([{ symbol: 'SPY', shares: 1 }]);
  });
});
