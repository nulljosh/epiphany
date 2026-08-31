// The Cloudflare migration turned `req` into a plain object. Stripe's webhook read it as a
// Node stream, so every delivery 500'd: the card was charged and pro was never granted.
import { describe, expect, it, vi } from 'vitest';

const gateway = vi.fn(async (req, res) => { res.status(200).json({ seen: req }); });
vi.mock('../api/gateway.js', () => ({ default: gateway }));

const { default: worker } = await import('../worker/index.js');
const env = { BLOB: { get: vi.fn(), put: vi.fn() } };

const post = (body, type) =>
  worker.fetch(
    new Request('https://epiphany.heyitsmejosh.com/api/stripe-webhook', {
      method: 'POST', headers: { 'content-type': type }, body,
    }),
    env, {},
  );

describe('worker api adapter', () => {
  it('hands the handler the exact bytes Stripe signed, alongside the parsed body', async () => {
    const raw = '{"id":"evt_1","type":"checkout.session.completed"}';
    await post(raw, 'application/json');
    const req = gateway.mock.calls.at(-1)[0];
    expect(req.rawBody).toBe(raw);
    expect(req.body).toEqual({ id: 'evt_1', type: 'checkout.session.completed' });
  });

  it('still parses JSON for every other handler', async () => {
    await post('{"a":1}', 'application/json');
    expect(gateway.mock.calls.at(-1)[0].body).toEqual({ a: 1 });
  });

  it('survives an empty body instead of throwing', async () => {
    await post('', 'application/json');
    const req = gateway.mock.calls.at(-1)[0];
    expect(req.body).toBeUndefined();
    expect(req.rawBody).toBe('');
  });
});
