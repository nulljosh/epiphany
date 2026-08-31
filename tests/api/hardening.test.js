// Regression tests for the auth/avatar hardening pass. Each case asserts the hole that
// was actually open, so reverting a guard fails here rather than in production.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReqRes, createMockKV, resetAllMocks, seedUser, getKVStore } from './_mocks.js';

const mockGetSessionUser = vi.fn();

vi.mock('../../server/api/_kv.js', () => ({
  getKv: vi.fn(async () => mockKv),
}));

vi.mock('../../server/api/auth-helpers.js', () => ({
  getSessionUser: (...args) => mockGetSessionUser(...args),
  parseCookies: () => ({}),
  errorResponse: (res, status, message) => res.status(status).json({ error: message }),
}));

vi.mock('../../server/api/supabase.js', () => ({
  supabaseRequest: vi.fn(async () => ({})),
  supabaseConfigured: () => false,
}));

vi.mock('../../server/api/_email.js', () => ({ sendEmail: vi.fn(async () => true) }));

vi.mock('bcryptjs', () => ({
  default: {
    hash: async (p) => `hashed:${p}`,
    compare: async (p, h) => h === `hashed:${p}`,
  },
}));

let mockKv;

beforeEach(() => {
  resetAllMocks();
  vi.resetModules();
  mockGetSessionUser.mockReset();
  mockKv = createMockKV();
});

async function callAuth(opts) {
  const { default: handler } = await import('../../server/api/auth.js');
  const { req, res } = createReqRes(opts);
  await handler(req, res);
  return res;
}

describe('auth rate limiting covers more than login', () => {
  // Before this pass only `login` was throttled, so `lookup` was a free
  // account-existence oracle and `forgot-password` an unmetered mail cannon.
  const LIMIT = 15;

  it.each([
    ['lookup', { method: 'GET', action: 'lookup', query: { email: 'a@b.com' } }],
    ['register', { method: 'POST', action: 'register', body: { email: 'a@b.com', password: 'password123' } }],
    ['forgot-password', { method: 'POST', action: 'forgot-password', body: { email: 'a@b.com' } }],
  ])('throttles %s after the shared budget is spent', async (_name, opts) => {
    let last;
    for (let i = 0; i < LIMIT + 1; i++) last = await callAuth(opts);
    expect(last.statusCode).toBe(429);
  });

  it('shares one budget across actions, so switching action does not reset it', async () => {
    for (let i = 0; i < LIMIT; i++) {
      await callAuth({ method: 'GET', action: 'lookup', query: { email: 'a@b.com' } });
    }
    const res = await callAuth({ method: 'POST', action: 'login', body: { email: 'a@b.com', password: 'x' } });
    expect(res.statusCode).toBe(429);
  });

  it('leaves unthrottled actions alone', async () => {
    let last;
    for (let i = 0; i < LIMIT + 1; i++) {
      mockGetSessionUser.mockResolvedValue(null);
      last = await callAuth({ method: 'POST', action: 'logout' });
    }
    expect(last.statusCode).not.toBe(429);
  });
});

describe('avatar GET requires a session and reads only your own row', () => {
  async function callAvatar(opts) {
    const { default: handler } = await import('../../server/api/avatar.js');
    const { req, res } = createReqRes(opts);
    await handler(req, res);
    return res;
  }

  it('rejects an unauthenticated read', async () => {
    seedUser({ email: 'victim@example.com', id: 'user-victim', avatarUrl: 'data:image/svg+xml;base64,AAA' });
    mockGetSessionUser.mockResolvedValue(null);
    const res = await callAvatar({ method: 'GET', query: { userId: 'user-victim' } });
    expect(res.statusCode).toBe(401);
    expect(res.data.avatarUrl).toBeUndefined();
  });

  it('ignores a userId query param and returns the session user’s avatar', async () => {
    seedUser({ email: 'victim@example.com', id: 'user-victim', avatarUrl: 'VICTIM' });
    seedUser({ email: 'me@example.com', id: 'user-me', avatarUrl: 'MINE' });
    mockGetSessionUser.mockResolvedValue({ userId: 'user-me', email: 'me@example.com' });
    const res = await callAvatar({ method: 'GET', query: { userId: 'user-victim' } });
    expect(res.statusCode).toBe(200);
    expect(res.data.avatarUrl).toBe('MINE');
  });

  it('does not scan the whole user keyspace', async () => {
    seedUser({ email: 'me@example.com', id: 'user-me', avatarUrl: 'MINE' });
    mockGetSessionUser.mockResolvedValue({ userId: 'user-me', email: 'me@example.com' });
    await callAvatar({ method: 'GET' });
    expect(mockKv.keys).not.toHaveBeenCalled();
  });
});

describe('validate-link does not hand upstream error text to the caller', () => {
  it('returns a fixed message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED 10.0.0.5:443'); }));
    const { default: handler } = await import('../../server/api/validate-link.js');
    const { req, res } = createReqRes({ method: 'GET', query: { slug: 'some-event' } });
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.data.details).toBeUndefined();
    expect(JSON.stringify(res.data)).not.toContain('10.0.0.5');
    vi.unstubAllGlobals();
  });
});
