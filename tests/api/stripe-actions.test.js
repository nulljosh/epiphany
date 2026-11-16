import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map();
const portal = vi.hoisted(() => vi.fn(async () => ({ url: 'https://billing' })));
const retrieve = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn(async () => ({ id: 'cs_1', url: 'https://checkout' })));
vi.mock('stripe', () => ({ default: class {
  billingPortal = { sessions: { create: portal } };
  checkout = { sessions: { retrieve, create } };
} }));
vi.mock('../../server/api/_kv.js', () => ({
  getKv: async () => ({ get: async (k) => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); } }),
}));
const { default: handler } = await import('../../server/api/stripe.js');
const res = () => { const r = { status: vi.fn(() => r), json: vi.fn(() => r) }; return r; };
const req = (action, body = {}, cookie = 'session=tok') => ({ method: 'POST', query: { action }, body, headers: { cookie } });

describe('Stripe actions only touch the signed-in account', () => {
  beforeEach(() => {
    store.clear(); vi.clearAllMocks();
    process.env.STRIPE_PRICE_ID_MONTHLY = 'price_m'; process.env.STRIPE_PRICE_ID_YEARLY = 'price_y';
    store.set('session:tok', { email: 'me@x.test' });
    store.set('user:me@x.test', { email: 'me@x.test', stripe_customer_id: 'cus_me' });
  });

  it('portal ignores a customer id in the body and refuses anonymous callers', async () => {
    let r = res(); await handler(req('portal', { customerId: 'cus_victim' }), r);
    expect(portal).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_me' }));
    r = res(); await handler(req('portal', { customerId: 'cus_victim' }, ''), r);
    expect(r.status).toHaveBeenCalledWith(401);
  });

  it('resolve-session refuses a checkout another account started', async () => {
    retrieve.mockResolvedValue({ client_reference_id: 'other@x.test', customer: 'cus_other' });
    const r = res(); await handler(req('resolve-session', { sessionId: 'cs_x' }), r);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(store.get('user:me@x.test').stripe_customer_id).toBe('cus_me');
  });

  it('checkout is a subscription with one 7-day trial per account', async () => {
    let r = res(); await handler(req('checkout', { plan: 'yearly' }), r);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ mode: 'subscription', line_items: [{ price: 'price_y', quantity: 1 }], subscription_data: { trial_period_days: 7 } }));
    store.set('user:me@x.test', { email: 'me@x.test', stripe_customer_id: 'cus_me', stripeTrialUsed: true });
    r = res(); await handler(req('checkout', { plan: 'monthly' }), r);
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ subscription_data: {} }));
  });

  it('a lifetime buyer cannot be sold a subscription', async () => {
    store.set('sub:cus_me', { status: 'active' });
    const r = res(); await handler(req('checkout', { plan: 'monthly' }), r);
    expect(r.status).toHaveBeenCalledWith(409);
  });
});
