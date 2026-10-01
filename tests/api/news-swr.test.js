import { it, expect, vi } from 'vitest';

// A stale KV entry must be served at once, with the upstream refresh deferred to waitUntil.
const stale = { ts: Date.now() - 60 * 60 * 1000, data: { articles: [{ title: 'Old headline' }] } };
vi.mock('../../server/api/_kv.js', () => ({
  getKv: async () => ({ get: async () => stale, set: async () => {} }),
}));
const { default: handler } = await import('../../server/api/news.js');

it('serves stale KV news instantly and refreshes in the background', async () => {
  global.fetch = vi.fn(() => new Promise(() => {})); // upstream hangs forever
  const deferred = [];
  globalThis.__waitUntil = (p) => deferred.push(p);
  let body;
  const res = { setHeader() { return res; }, status() { return res; }, json(d) { body = d; return res; } };

  await handler({ method: 'GET', query: { category: 'business' }, headers: {} }, res);

  expect(body.articles[0].title).toBe('Old headline');
  expect(body.meta.status).toBe('stale');
  expect(deferred).toHaveLength(1);
  delete globalThis.__waitUntil;
});
