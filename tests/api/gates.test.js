import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAllMocks, getKVStore } from './_mocks.js';

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

const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS;

describe('gates.js', () => {
  beforeEach(() => {
    resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
  });

  describe('isAdmin', () => {
    it('returns true for an email in ADMIN_EMAILS', async () => {
      process.env.ADMIN_EMAILS = 'admin@example.com,demo@example.com';
      const { isAdmin } = await import('../../server/api/gates.js');
      expect(isAdmin('admin@example.com')).toBe(true);
      expect(isAdmin('demo@example.com')).toBe(true);
    });

    it('returns false for an email not in ADMIN_EMAILS', async () => {
      process.env.ADMIN_EMAILS = 'admin@example.com';
      const { isAdmin } = await import('../../server/api/gates.js');
      expect(isAdmin('nobody@example.com')).toBe(false);
    });

    it('returns false for everyone when ADMIN_EMAILS is empty (the prod bug we just fixed)', async () => {
      process.env.ADMIN_EMAILS = '';
      const { isAdmin } = await import('../../server/api/gates.js');
      expect(isAdmin('admin@example.com')).toBe(false);
    });
  });

  describe('isProByEmail', () => {
    it('returns true for an admin email with no Stripe customer at all', async () => {
      process.env.ADMIN_EMAILS = 'admin@example.com';
      const { isProByEmail } = await import('../../server/api/gates.js');
      getKVStore().set('user:admin@example.com', { email: 'admin@example.com', tier: 'free', stripe_customer_id: null });
      await expect(isProByEmail('admin@example.com')).resolves.toBe(true);
    });

    it('returns false for a free, non-admin user with no Stripe customer', async () => {
      process.env.ADMIN_EMAILS = 'admin@example.com';
      const { isProByEmail } = await import('../../server/api/gates.js');
      getKVStore().set('user:free@example.com', { email: 'free@example.com', tier: 'free', stripe_customer_id: null });
      await expect(isProByEmail('free@example.com')).resolves.toBe(false);
    });

    it('returns true for a non-admin user with an active subscription', async () => {
      process.env.ADMIN_EMAILS = 'admin@example.com';
      const { isProByEmail } = await import('../../server/api/gates.js');
      getKVStore().set('user:paid@example.com', { email: 'paid@example.com', tier: 'starter', stripe_customer_id: 'cus_123' });
      getKVStore().set('sub:cus_123', { status: 'active', priceId: 'price_999' });
      await expect(isProByEmail('paid@example.com')).resolves.toBe(true);
    });

    it('returns false when the subscription is canceled', async () => {
      process.env.ADMIN_EMAILS = 'admin@example.com';
      const { isProByEmail } = await import('../../server/api/gates.js');
      getKVStore().set('user:canceled@example.com', { email: 'canceled@example.com', tier: 'starter', stripe_customer_id: 'cus_456' });
      getKVStore().set('sub:cus_456', { status: 'canceled', priceId: 'price_999' });
      await expect(isProByEmail('canceled@example.com')).resolves.toBe(false);
    });

    it('returns false for a missing email', async () => {
      const { isProByEmail } = await import('../../server/api/gates.js');
      await expect(isProByEmail(undefined)).resolves.toBe(false);
    });
  });

  describe('isPro', () => {
    it('delegates to isProByEmail using session.email', async () => {
      process.env.ADMIN_EMAILS = 'admin@example.com';
      const { isPro } = await import('../../server/api/gates.js');
      getKVStore().set('user:admin@example.com', { email: 'admin@example.com', tier: 'free', stripe_customer_id: null });
      await expect(isPro({ email: 'admin@example.com' })).resolves.toBe(true);
    });

    it('returns false when session is missing', async () => {
      const { isPro } = await import('../../server/api/gates.js');
      await expect(isPro(undefined)).resolves.toBe(false);
    });
  });
});
