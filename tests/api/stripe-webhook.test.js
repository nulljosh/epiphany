import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ event: null }));
const write = vi.hoisted(() => vi.fn());
const read = vi.hoisted(() => vi.fn());
vi.mock('stripe', () => ({ default: class {
  webhooks = { constructEventAsync: vi.fn(async () => state.event) };
} }));
vi.mock('../../server/api/_kv.js', () => ({ getKv: async () => ({ setStrict: write, getStrict: read }) }));
import handler from '../../server/api/stripe-webhook.js';

function response() {
  const res = { status: vi.fn(() => res), json: vi.fn(() => res) };
  return res;
}
const request = { method: 'POST', rawBody: '{}', headers: { 'stripe-signature': 'test' } };

describe('Stripe payment fulfillment', () => {
  beforeEach(() => {
    write.mockReset().mockResolvedValue('OK');
    read.mockReset().mockResolvedValue(null);
    state.event = { type: 'checkout.session.completed', data: { object: { customer: 'cus_test', payment_status: 'paid' } } };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns an error on storage failure so Stripe retries', async () => {
    write.mockRejectedValue(new Error('storage unavailable'));
    const res = response(); await handler(request, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
  it('does not grant access for an unpaid completed checkout', async () => {
    state.event.data.object.payment_status = 'unpaid';
    const res = response(); await handler(request, res);
    expect(write).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
  it('grants access when a delayed payment succeeds', async () => {
    state.event.type = 'checkout.session.async_payment_succeeded';
    const res = response(); await handler(request, res);
    expect(write).toHaveBeenCalledWith('sub:cus_test', expect.objectContaining({ status: 'active' }));
    expect(res.status).toHaveBeenCalledWith(200);
  });
  it('ties the purchase to the account that started checkout', async () => {
    state.event.data.object.client_reference_id = 'a@b.test';
    read.mockResolvedValue({ email: 'a@b.test' });
    const res = response(); await handler(request, res);
    expect(write).toHaveBeenCalledWith('user:a@b.test', { email: 'a@b.test', stripe_customer_id: 'cus_test' });
    expect(res.status).toHaveBeenCalledWith(200);
  });
  it('never overwrites an account that already has a customer', async () => {
    state.event.data.object.client_reference_id = 'a@b.test';
    read.mockResolvedValue({ email: 'a@b.test', stripe_customer_id: 'cus_old' });
    const res = response(); await handler(request, res);
    expect(write).not.toHaveBeenCalledWith('user:a@b.test', expect.anything());
  });
  it('rejects a paid checkout without a customer', async () => {
    delete state.event.data.object.customer;
    const res = response(); await handler(request, res);
    expect(write).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
