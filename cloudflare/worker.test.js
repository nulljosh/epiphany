// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createNodeResponse } from './runtime-adapter.js';

describe('cloudflare worker scaffold', () => {
  it('contains an explicit local route map for read-only routes', async () => {
    const { LOCAL_ROUTE_LOADERS } = await import('./worker.js');

    expect(LOCAL_ROUTE_LOADERS).toHaveProperty('markets');
    expect(LOCAL_ROUTE_LOADERS).toHaveProperty('stocks-free');
    expect(LOCAL_ROUTE_LOADERS).toHaveProperty('weather');
    expect(LOCAL_ROUTE_LOADERS).toHaveProperty('news');
    expect(LOCAL_ROUTE_LOADERS).toHaveProperty('flights');
  });

  it('proxies unsupported routes to the Vercel fallback origin', async () => {
    const { default: worker } = await import('./worker.js');
    global.fetch = vi.fn().mockResolvedValue(new Response('proxied', { status: 200 }));

    const response = await worker.fetch(
      new Request('https://worker.example.com/api/auth?action=me'),
      { VERCEL_FALLBACK_ORIGIN: 'https://monica.heyitsmejosh.com' }
    );

    expect(global.fetch).toHaveBeenCalledOnce();
    expect(global.fetch.mock.calls[0][0].toString()).toBe('https://monica.heyitsmejosh.com/api/auth?action=me');
    expect(await response.text()).toBe('proxied');
  });

  it('converts node-style response helpers into a real fetch Response', async () => {
    const res = createNodeResponse();
    res.status(201);
    res.setHeader('X-Test', 'yes');
    res.json({ ok: true });

    const response = res.toResponse();

    expect(response.status).toBe(201);
    expect(response.headers.get('X-Test')).toBe('yes');
    expect(await response.json()).toEqual({ ok: true });
  });
});
