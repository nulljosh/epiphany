import { beforeEach, describe, expect, it, vi } from 'vitest';

const kvStore = new Map();
const mockGetSessionUser = vi.fn();
let tokenCounter = 0;
let uuidCounter = 0;

function matchesPattern(key, pattern) {
  if (!pattern || pattern === '*') return true;
  const regex = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return regex.test(key);
}

vi.mock('../../server/api/_kv.js', () => ({
  getKv: vi.fn(async () => ({
    get: vi.fn(async (key) => kvStore.get(key)),
    set: vi.fn(async (key, value) => {
      kvStore.set(key, value);
    }),
    del: vi.fn(async (key) => {
      kvStore.delete(key);
    }),
    keys: vi.fn(async (pattern = '*') => Array.from(kvStore.keys()).filter((key) => matchesPattern(key, pattern))),
  })),
}));

vi.mock('../../server/api/auth-helpers.js', () => ({
  parseCookies: (req) => {
    const header = req.headers?.cookie || '';
    return header.split(';').reduce((cookies, pair) => {
      const [key, ...rest] = pair.trim().split('=');
      if (key) cookies[key] = rest.join('=');
      return cookies;
    }, {});
  },
  getSessionUser: mockGetSessionUser,
  errorResponse: (res, status, message) => res.status(status).json({ error: message }),
}));

vi.mock('../../server/api/supabase.js', () => ({
  supabaseConfigured: vi.fn(() => false),
  supabaseRequest: vi.fn(),
}));

vi.mock('../../server/api/_email.js', () => ({
  sendEmail: vi.fn(async () => ({ id: 'mock-email-id' })),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (password) => `hashed:${password}`),
    compare: vi.fn(async (password, hash) => hash === `hashed:${password}`),
  },
}));

vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => `uuid-${++uuidCounter}`),
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => `token-${++tokenCounter}`),
    })),
  },
}));

function createReqRes({
  method = 'POST',
  action,
  body = {},
  cookie = '',
  remoteAddress = '127.0.0.1',
  headers = {},
} = {}) {
  const req = {
    method,
    query: action ? { action } : {},
    body,
    headers: {
      cookie,
      ...headers,
    },
    socket: { remoteAddress },
  };

  const res = {
    statusCode: null,
    data: null,
    headers: {},
    writeHeadHeaders: null,
    status: vi.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((data) => {
      res.data = data;
      return res;
    }),
    setHeader: vi.fn((name, value) => {
      res.headers[name] = value;
      return res;
    }),
    writeHead: vi.fn((code, headers) => {
      res.statusCode = code;
      res.writeHeadHeaders = headers;
      return res;
    }),
    end: vi.fn(() => res),
  };

  return { req, res };
}

function seedUser(overrides = {}) {
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hashed:password123',
    verified: false,
    tier: 'free',
    stripeCustomerId: null,
    watchlist: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  kvStore.set(`user:${user.email}`, user);
  return user;
}

describe('Auth API', () => {
  let handler;

  beforeEach(async () => {
    kvStore.clear();
    mockGetSessionUser.mockReset();
    tokenCounter = 0;
    uuidCounter = 0;
    vi.resetModules();
    ({ default: handler } = await import('../../server/api/auth.js'));
  });

  describe('register', () => {
    it('should register successfully', async () => {
      const { req, res } = createReqRes({
        action: 'register',
        body: { email: 'User@Example.com', password: 'password123' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.data.ok).toBe(true);
      expect(res.data.user).toMatchObject({
        email: 'user@example.com',
        verified: false,
        tier: 'free',
      });
      expect(kvStore.get('user:user@example.com')).toMatchObject({
        id: 'uuid-1',
        email: 'user@example.com',
        passwordHash: 'hashed:password123',
      });
      expect(kvStore.get('verify:token-1')).toEqual({ email: 'user@example.com' });
      expect(kvStore.get('session:token-2')).toMatchObject({
        userId: 'uuid-1',
        email: 'user@example.com',
      });
      expect(res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.arrayContaining([expect.stringContaining('opticon_session=token-2')]),
      );
    });

    it('should reject missing fields', async () => {
      const { req, res } = createReqRes({
        action: 'register',
        body: { email: 'user@example.com' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data).toEqual({ error: 'Email and password required' });
    });

    it('should reject short passwords', async () => {
      const { req, res } = createReqRes({
        action: 'register',
        body: { email: 'user@example.com', password: 'short' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data).toEqual({ error: 'Password must be at least 8 characters' });
    });

    it('should reject duplicate emails', async () => {
      seedUser();
      const { req, res } = createReqRes({
        action: 'register',
        body: { email: 'USER@example.com', password: 'password123' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.data).toEqual({ error: 'Account already exists' });
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      seedUser();
      const { req, res } = createReqRes({
        action: 'login',
        body: { email: 'user@example.com', password: 'password123' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data.ok).toBe(true);
      expect(res.data.user.email).toBe('user@example.com');
      expect(kvStore.get('session:token-1')).toMatchObject({
        userId: 'user-1',
        email: 'user@example.com',
      });
      expect(res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.arrayContaining([expect.stringContaining('opticon_session=token-1')]),
      );
    });

    it('should reject wrong passwords', async () => {
      seedUser();
      const { req, res } = createReqRes({
        action: 'login',
        body: { email: 'user@example.com', password: 'wrongpass' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.data).toEqual({ error: 'Invalid credentials' });
    });

    it('should reject missing fields', async () => {
      const { req, res } = createReqRes({
        action: 'login',
        body: { email: 'user@example.com' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data).toEqual({ error: 'Email and password required' });
    });

    it('should rate limit repeated attempts', async () => {
      seedUser();

      for (let attempt = 1; attempt <= 15; attempt++) {
        const { req, res } = createReqRes({
          action: 'login',
          body: { email: 'user@example.com', password: 'wrongpass' },
          remoteAddress: '10.0.0.1',
        });

        await handler(req, res);
        expect(res.statusCode).toBe(401);
      }

      const { req, res } = createReqRes({
        action: 'login',
        body: { email: 'user@example.com', password: 'password123' },
        remoteAddress: '10.0.0.1',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.data).toEqual({ error: 'Too many login attempts. Try again in 15 minutes.' });
    });
  });

  describe('me', () => {
    it('should return the authenticated session', async () => {
      seedUser({ verified: true });
      mockGetSessionUser.mockResolvedValue({
        userId: 'user-1',
        email: 'user@example.com',
        tier: 'free',
      });
      const { req, res } = createReqRes({ method: 'GET', action: 'me' });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data).toEqual({
        authenticated: true,
        user: {
          id: 'user-1',
          email: 'user@example.com',
          verified: true,
          tier: 'free',
          stripeCustomerId: null,
          watchlist: null,
          avatarUrl: null,
        },
      });
    });

    it('should return unauthenticated when no session exists', async () => {
      mockGetSessionUser.mockResolvedValue(null);
      const { req, res } = createReqRes({ method: 'GET', action: 'me' });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data).toEqual({ authenticated: false });
    });
  });

  describe('logout', () => {
    it('should clear the session', async () => {
      kvStore.set('session:session-token', { email: 'user@example.com' });
      const { req, res } = createReqRes({
        action: 'logout',
        cookie: 'opticon_session=session-token',
      });

      await handler(req, res);

      expect(kvStore.has('session:session-token')).toBe(false);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data).toEqual({ ok: true });
      expect(res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.arrayContaining([expect.stringContaining('opticon_session=;')]),
      );
    });
  });

  describe('change-password', () => {
    it('should update the password successfully', async () => {
      seedUser();
      mockGetSessionUser.mockResolvedValue({ email: 'user@example.com' });
      const { req, res } = createReqRes({
        action: 'change-password',
        body: { currentPassword: 'password123', newPassword: 'newpassword123' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data).toMatchObject({
        ok: true,
        message: 'Password updated successfully',
      });
      expect(kvStore.get('user:user@example.com').passwordHash).toBe('hashed:newpassword123');
    });

    it('should reject a wrong current password', async () => {
      seedUser();
      mockGetSessionUser.mockResolvedValue({ email: 'user@example.com' });
      const { req, res } = createReqRes({
        action: 'change-password',
        body: { currentPassword: 'wrongpass', newPassword: 'newpassword123' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.data).toEqual({ error: 'Current password is incorrect' });
    });

    it('should reject short new passwords', async () => {
      seedUser();
      mockGetSessionUser.mockResolvedValue({ email: 'user@example.com' });
      const { req, res } = createReqRes({
        action: 'change-password',
        body: { currentPassword: 'password123', newPassword: 'short' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data).toEqual({ error: 'Password must be at least 8 characters' });
    });

    it('should reject unauthenticated requests', async () => {
      mockGetSessionUser.mockResolvedValue(null);
      const { req, res } = createReqRes({
        action: 'change-password',
        body: { currentPassword: 'password123', newPassword: 'newpassword123' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.data).toEqual({ error: 'Authentication required' });
    });
  });

  describe('change-email', () => {
    it('should update the email successfully', async () => {
      seedUser();
      kvStore.set('session:session-token', {
        userId: 'user-1',
        email: 'user@example.com',
        tier: 'free',
      });
      mockGetSessionUser.mockResolvedValue({
        userId: 'user-1',
        email: 'user@example.com',
        tier: 'free',
      });
      const { req, res } = createReqRes({
        action: 'change-email',
        body: { newEmail: 'new@example.com', password: 'password123' },
        cookie: 'opticon_session=session-token',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data).toMatchObject({
        ok: true,
        message: 'Email updated successfully',
      });
      expect(kvStore.has('user:user@example.com')).toBe(false);
      expect(kvStore.get('user:new@example.com')).toMatchObject({
        email: 'new@example.com',
      });
      expect(kvStore.get('session:session-token')).toMatchObject({
        email: 'new@example.com',
      });
    });

    it('should reject a wrong password', async () => {
      seedUser();
      mockGetSessionUser.mockResolvedValue({ email: 'user@example.com' });
      const { req, res } = createReqRes({
        action: 'change-email',
        body: { newEmail: 'new@example.com', password: 'wrongpass' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.data).toEqual({ error: 'Password is incorrect' });
    });

    it('should reject the same email', async () => {
      seedUser();
      mockGetSessionUser.mockResolvedValue({ email: 'user@example.com' });
      const { req, res } = createReqRes({
        action: 'change-email',
        body: { newEmail: 'user@example.com', password: 'password123' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data).toEqual({ error: 'New email must be different' });
    });

    it('should reject duplicate emails', async () => {
      seedUser();
      seedUser({
        id: 'user-2',
        email: 'taken@example.com',
        passwordHash: 'hashed:otherpassword',
      });
      mockGetSessionUser.mockResolvedValue({ email: 'user@example.com' });
      const { req, res } = createReqRes({
        action: 'change-email',
        body: { newEmail: 'taken@example.com', password: 'password123' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.data).toEqual({ error: 'Account already exists' });
    });

    it('should reject unauthenticated requests', async () => {
      mockGetSessionUser.mockResolvedValue(null);
      const { req, res } = createReqRes({
        action: 'change-email',
        body: { newEmail: 'new@example.com', password: 'password123' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.data).toEqual({ error: 'Authentication required' });
    });
  });

  describe('delete-account', () => {
    it('should delete the account successfully', async () => {
      const user = seedUser();
      kvStore.set('portfolio:user-1', { holdings: [] });
      kvStore.set('session:session-token', {
        userId: user.id,
        email: user.email,
      });
      mockGetSessionUser.mockResolvedValue({
        userId: user.id,
        email: user.email,
      });
      const { req, res } = createReqRes({
        action: 'delete-account',
        body: { password: 'password123' },
        cookie: 'opticon_session=session-token',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data).toEqual({ ok: true, message: 'Account deleted successfully' });
      expect(kvStore.has('user:user@example.com')).toBe(false);
      expect(kvStore.has('portfolio:user-1')).toBe(false);
      expect(kvStore.has('session:session-token')).toBe(false);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.arrayContaining([expect.stringContaining('opticon_session=;')]),
      );
    });

    it('should reject a wrong password', async () => {
      seedUser();
      mockGetSessionUser.mockResolvedValue({ email: 'user@example.com' });
      const { req, res } = createReqRes({
        action: 'delete-account',
        body: { password: 'wrongpass' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.data).toEqual({ error: 'Password is incorrect' });
    });

    it('should reject unauthenticated requests', async () => {
      mockGetSessionUser.mockResolvedValue(null);
      const { req, res } = createReqRes({
        action: 'delete-account',
        body: { password: 'password123' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.data).toEqual({ error: 'Authentication required' });
    });
  });

  describe('forgot-password', () => {
    it('should always return the generic message for existing accounts', async () => {
      seedUser();
      const { req, res } = createReqRes({
        action: 'forgot-password',
        body: { email: 'user@example.com' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data).toEqual({
        ok: true,
        message: 'If an account exists with that email, a reset link has been generated.',
      });
      expect(kvStore.get('reset:token-1')).toEqual({ email: 'user@example.com' });
    });

    it('should always return the generic message for unknown accounts', async () => {
      const { req, res } = createReqRes({
        action: 'forgot-password',
        body: { email: 'missing@example.com' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data).toEqual({
        ok: true,
        message: 'If an account exists with that email, a reset link has been generated.',
      });
      expect(Array.from(kvStore.keys()).some((key) => key.startsWith('reset:'))).toBe(false);
    });
  });

  describe('reset-password', () => {
    it('should reset the password successfully', async () => {
      seedUser();
      kvStore.set('reset:reset-token', { email: 'user@example.com' });
      const { req, res } = createReqRes({
        action: 'reset-password',
        body: { token: 'reset-token', password: 'newpassword123' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data).toEqual({ ok: true, message: 'Password has been reset successfully' });
      expect(kvStore.get('user:user@example.com').passwordHash).toBe('hashed:newpassword123');
      expect(kvStore.has('reset:reset-token')).toBe(false);
    });

    it('should reject invalid tokens', async () => {
      const { req, res } = createReqRes({
        action: 'reset-password',
        body: { token: 'bad-token', password: 'newpassword123' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data).toEqual({ error: 'Invalid or expired reset token' });
    });

    it('should reject short passwords', async () => {
      const { req, res } = createReqRes({
        action: 'reset-password',
        body: { token: 'reset-token', password: 'short' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data).toEqual({ error: 'Password must be at least 8 characters' });
    });
  });

  describe('verify-email', () => {
    it('should verify the email successfully', async () => {
      seedUser();
      kvStore.set('verify:verify-token', { email: 'user@example.com' });
      const { req, res } = createReqRes({
        action: 'verify-email',
        body: { token: 'verify-token' },
      });

      await handler(req, res);

      expect(kvStore.get('user:user@example.com').verified).toBe(true);
      expect(kvStore.has('verify:verify-token')).toBe(false);
      expect(res.writeHead).toHaveBeenCalledWith(
        302,
        expect.objectContaining({ Location: expect.stringContaining('?verified=1') }),
      );
      expect(res.end).toHaveBeenCalled();
    });

    it('should reject invalid verification tokens', async () => {
      const { req, res } = createReqRes({
        action: 'verify-email',
        body: { token: 'bad-token' },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data).toEqual({ error: 'Invalid or expired verification token' });
    });
  });

  it('should return 400 for unknown actions', async () => {
    const { req, res } = createReqRes({ action: 'unknown-action' });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.data).toEqual({ error: 'Unknown action' });
  });

  it('should return 405 for unsupported methods', async () => {
    const { req, res } = createReqRes({
      method: 'PUT',
      action: 'register',
      body: { email: 'user@example.com', password: 'password123' },
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.data).toEqual({ error: 'Method not allowed' });
  });
});
