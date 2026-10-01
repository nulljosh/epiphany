import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('in-memory KV (local testing only)', () => {
  beforeEach(() => { vi.resetModules(); });

  it('is used only when asked for and not in production', async () => {
    process.env.EPIPHANY_LOCAL_KV = '1'; process.env.NODE_ENV = 'development';
    const { getKv } = await import('../../server/api/_kv.js');
    const kv = await getKv();
    await kv.set('a', { x: 1 });
    expect(await kv.get('a')).toEqual({ x: 1 });
    expect(await kv.setStrict('a', 2, { nx: true })).toBeNull();
    expect(await kv.keys('*')).toEqual(['a']);
    await kv.del('a');
    expect(await kv.get('a')).toBeNull();
  });

  it('refuses to stand in for the real database in production', async () => {
    process.env.EPIPHANY_LOCAL_KV = '1'; process.env.NODE_ENV = 'production';
    delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
    const { getKv } = await import('../../server/api/_kv.js');
    expect(await getKv()).toBeNull();
    process.env.NODE_ENV = 'test'; delete process.env.EPIPHANY_LOCAL_KV;
  });
});
