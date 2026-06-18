import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReqRes, resetAllMocks, getKVStore } from './_mocks.js';
import { FEATURES, isPremiumFeature } from '../../src/config/features.js';

const mockGetSessionUser = vi.fn();

vi.mock('../../server/api/_kv.js', () => ({
  getKv: vi.fn(async () => {
    const kvStore = getKVStore();
    return {
      get: vi.fn(async (key) => kvStore.get(key)),
      set: vi.fn(async (key, value) => { kvStore.set(key, value); }),
      del: vi.fn(async (key) => { kvStore.delete(key); }),
    };
  }),
}));

vi.mock('../../server/api/auth-helpers.js', () => ({
  getSessionUser: mockGetSessionUser,
  errorResponse: (res, status, message) => res.status(status).json({ error: message }),
}));

describe('autopilot premium gate (server/api/broker/autopilot.js)', () => {
  beforeEach(() => {
    resetAllMocks();
    vi.resetModules();
    mockGetSessionUser.mockReset();
    process.env.ADMIN_EMAILS = 'admin@example.com';
  });

  async function postAutopilot(session, body = { enabled: true }) {
    mockGetSessionUser.mockResolvedValue(session);
    const { default: handler } = await import('../../server/api/broker/autopilot.js');
    const { req, res } = createReqRes({ method: 'POST', body });
    await handler(req, res);
    return res;
  }

  it('blocks a free user with 402', async () => {
    getKVStore().set('user:free@example.com', { email: 'free@example.com', tier: 'free', stripe_customer_id: null });
    const res = await postAutopilot({ userId: 'u-free', email: 'free@example.com' });
    expect(res.statusCode).toBe(402);
    expect(res.data.error).toMatch(/premium/i);
  });

  it('allows an admin-listed user', async () => {
    getKVStore().set('user:admin@example.com', { email: 'admin@example.com', tier: 'free', stripe_customer_id: null });
    const res = await postAutopilot({ userId: 'u-admin', email: 'admin@example.com' });
    expect(res.statusCode).toBe(200);
  });

  it('allows a user with an active paid subscription', async () => {
    getKVStore().set('user:paid@example.com', { email: 'paid@example.com', tier: 'starter', stripe_customer_id: 'cus_789' });
    getKVStore().set('sub:cus_789', { status: 'active', priceId: 'price_999' });
    const res = await postAutopilot({ userId: 'u-paid', email: 'paid@example.com' });
    expect(res.statusCode).toBe(200);
  });

  it('GET reflects pro=false for a free user without enabling settings', async () => {
    getKVStore().set('user:free2@example.com', { email: 'free2@example.com', tier: 'free', stripe_customer_id: null });
    mockGetSessionUser.mockResolvedValue({ userId: 'u-free2', email: 'free2@example.com' });
    const { default: handler } = await import('../../server/api/broker/autopilot.js');
    const { req, res } = createReqRes({ method: 'GET' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.data.pro).toBe(false);
  });
});

describe('FEATURES config (src/config/features.js)', () => {
  it('marks autopilot as premium', () => {
    expect(isPremiumFeature('autopilot')).toBe(true);
  });

  it('marks ambient/acquisition features as free', () => {
    for (const key of ['map', 'events', 'news', 'markets', 'weather']) {
      expect(isPremiumFeature(key)).toBe(false);
      expect(FEATURES[key]).toBe('free');
    }
  });
});
