import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map();
vi.mock('../../server/api/_kv.js', () => ({
  getKv: async () => ({ get: async (k) => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); } }),
}));

const web = { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/605 Safari/605' } };
const app = { headers: { 'user-agent': 'Epiphany/2.5.14 CFNetwork/1494.0.7 Darwin/23.4.0' } };

describe('Premium gate', () => {
  let gates;
  beforeEach(async () => {
    vi.resetModules(); store.clear();
    process.env.ADMIN_EMAILS = 'owner@example.test';
    delete process.env.EPIPHANY_REQUIRE_PRO;
    gates = await import('../../server/api/gates.js');
  });

  it('a free account on the web is not Premium', async () => {
    store.set('user:free@example.test', { email: 'free@example.test' });
    expect(await gates.isProByEmail('free@example.test', web)).toBe(false);
  });

  it('a web purchase is Premium, and so is a comped tier', async () => {
    store.set('user:paid@example.test', { stripe_customer_id: 'cus_1' });
    store.set('sub:cus_1', { status: 'active' });
    store.set('user:comp@example.test', { tier: 'premium' });
    expect(await gates.isProByEmail('paid@example.test', web)).toBe(true);
    expect(await gates.isProByEmail('comp@example.test', web)).toBe(true);
  });

  it('the owner is always Premium, even on a request the app made without a purchase', async () => {
    expect(await gates.isProByEmail('owner@example.test', web)).toBe(true);
  });

  it('App Store buyers are Premium from the app and the mark is lifetime Pro everywhere', async () => {
    store.set('user:buyer@example.test', { email: 'buyer@example.test' });
    expect(await gates.isProByEmail('buyer@example.test', app)).toBe(true);
    expect(store.get('user:buyer@example.test').nativeApp).toBe(true);
    expect(await gates.isProByEmail('buyer@example.test')).toBe(true);
    expect(await gates.isProByEmail('buyer@example.test', web)).toBe(true);
  });

  it('once the app is free the User-Agent unlocks nothing, but old marks still count', async () => {
    process.env.EPIPHANY_FREE_SINCE = '2026-01-01T00:00:00Z';
    store.set('user:new@example.test', { email: 'new@example.test' });
    store.set('user:old@example.test', { email: 'old@example.test', nativeApp: true });
    expect(await gates.isProByEmail('new@example.test', app)).toBe(false);
    expect(store.get('user:new@example.test').nativeApp).toBeUndefined();
    expect(await gates.isProByEmail('old@example.test', web)).toBe(true);
    delete process.env.EPIPHANY_FREE_SINCE;
  });

  it('Stripe: the old $1 purchase is lifetime, a trial is Pro, a canceled sub is not', async () => {
    store.set('user:life@example.test', { stripe_customer_id: 'cus_l' });
    store.set('sub:cus_l', { status: 'active' });
    store.set('user:trial@example.test', { stripe_customer_id: 'cus_t' });
    store.set('sub:cus_t', { status: 'trialing', subscriptionId: 'sub_t' });
    store.set('user:gone@example.test', { stripe_customer_id: 'cus_g' });
    store.set('sub:cus_g', { status: 'canceled', subscriptionId: 'sub_g' });
    expect(await gates.isProByEmail('life@example.test', web)).toBe(true);
    expect(await gates.isProByEmail('trial@example.test', web)).toBe(true);
    expect(await gates.isProByEmail('gone@example.test', web)).toBe(false);
  });

  it('an App Store sub counts until it expires, then Apple is asked once an hour', async () => {
    const future = new Date(Date.now() + 86400e3).toISOString();
    store.set('user:sub@example.test', { appleOriginalTransactionId: '7', appleExpiresAt: future });
    expect(await gates.isProByEmail('sub@example.test', web)).toBe(true);
    store.set('user:lapsed@example.test', { appleOriginalTransactionId: '8', appleExpiresAt: '2020-01-01T00:00:00Z', appleCheckedAt: new Date().toISOString() });
    expect(await gates.isProByEmail('lapsed@example.test', web)).toBe(false);
  });

  it('a script claiming to be a browser or sending nothing does not get the app unlock', async () => {
    store.set('user:x@example.test', { email: 'x@example.test' });
    expect(await gates.isProByEmail('x@example.test', { headers: { 'user-agent': 'curl/8.4.0' } })).toBe(false);
    expect(await gates.isProByEmail('x@example.test', { headers: {} })).toBe(false);
    expect(await gates.isProByEmail('x@example.test')).toBe(false);
  });

  it('the app can also say so with a header', async () => {
    expect(gates.isNativeClient({ headers: { 'x-epiphany-client': 'ios' } })).toBe(true);
    expect(gates.isNativeClient({ headers: { 'x-epiphany-client': 'web' } })).toBe(false);
  });

  it('the escape hatch opens everything again', async () => {
    process.env.EPIPHANY_REQUIRE_PRO = 'false';
    store.set('user:free@example.test', { email: 'free@example.test' });
    expect(await gates.isProByEmail('free@example.test', web)).toBe(true);
  });
});
