import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReqRes } from './_mocks.js';

const supabaseRows = [];
let requestId = 0;

vi.mock('../../server/api/auth-helpers.js', () => ({
  getSessionUser: vi.fn(async (req) => {
    const cookie = req.headers?.cookie || '';
    if (cookie.includes('epiphany_session=valid')) {
      return { userId: 'user-1', email: 'user@example.com', tier: 'free' };
    }
    return null;
  }),
  errorResponse: (res, status, message) => res.status(status).json({ error: message }),
}));

vi.mock('../../server/api/supabase.js', () => ({
  supabaseConfigured: vi.fn(() => true),
  supabaseRequest: vi.fn(async (query, options = {}) => {
    const method = options.method || 'GET';
    const body = options.body || {};

    // Mock Supabase behavior
    if (method === 'GET') {
      // List watchlist items filtered by user_email
      if (query.includes('user_email=eq')) {
        const email = decodeURIComponent(query.split('user_email=eq.')[1].split('&')[0]);
        return supabaseRows.filter((r) => r.user_email === email);
      }
      return supabaseRows;
    }

    if (method === 'POST') {
      // Add new watchlist item
      const { user_email, symbol } = body;
      const existing = supabaseRows.find(
        (r) => r.user_email === user_email && r.symbol === symbol
      );
      if (existing) {
        const err = new Error('Duplicate key');
        err.status = 409;
        throw err;
      }
      const item = {
        id: `watchlist-${++requestId}`,
        user_email,
        symbol: symbol.toUpperCase(),
        added_at: new Date().toISOString(),
      };
      supabaseRows.push(item);
      return [item];
    }

    if (method === 'DELETE') {
      // Delete watchlist items
      if (query.includes('user_email=eq')) {
        const email = decodeURIComponent(query.split('user_email=eq.')[1].split('&')[0]);
        const symbol = decodeURIComponent(query.split('symbol=eq.')[1]);
        const idx = supabaseRows.findIndex(
          (r) => r.user_email === email && r.symbol === symbol.toUpperCase()
        );
        if (idx >= 0) supabaseRows.splice(idx, 1);
      }
      return [];
    }

    return [];
  }),
}));


describe('Watchlist API', () => {
  let handler;

  beforeEach(async () => {
    supabaseRows.length = 0;
    requestId = 0;
    vi.resetModules();
    ({ default: handler } = await import('../../server/api/watchlist.js'));
  });

  describe('GET: list watchlist', () => {
    it('should require authentication', async () => {
      const { req, res } = createReqRes({
        method: 'GET',
        cookie: '',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.data.error).toContain('Authentication required');
    });

    it('should return empty list for new user', async () => {
      const { req, res } = createReqRes({
        method: 'GET',
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data).toEqual([]);
    });

    it('should return user watchlist items', async () => {
      supabaseRows.push({
        id: 'w-1',
        user_email: 'user@example.com',
        symbol: 'AAPL',
        added_at: '2026-01-01T00:00:00.000Z',
      });
      supabaseRows.push({
        id: 'w-2',
        user_email: 'user@example.com',
        symbol: 'MSFT',
        added_at: '2026-01-02T00:00:00.000Z',
      });

      const { req, res } = createReqRes({
        method: 'GET',
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data).toHaveLength(2);
      expect(res.data[0].symbol).toBe('AAPL');
      expect(res.data[1].symbol).toBe('MSFT');
    });

    it('should only return items for authenticated user', async () => {
      supabaseRows.push({
        id: 'w-1',
        user_email: 'user@example.com',
        symbol: 'AAPL',
        added_at: '2026-01-01T00:00:00.000Z',
      });
      supabaseRows.push({
        id: 'w-2',
        user_email: 'other@example.com',
        symbol: 'GOOGL',
        added_at: '2026-01-02T00:00:00.000Z',
      });

      const { req, res } = createReqRes({
        method: 'GET',
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data).toHaveLength(1);
      expect(res.data[0].user_email).toBe('user@example.com');
    });
  });

  describe('POST: add symbol to watchlist', () => {
    it('should require authentication', async () => {
      const { req, res } = createReqRes({
        method: 'POST',
        body: { symbol: 'AAPL' },
        cookie: '',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.data.error).toContain('Authentication required');
    });

    it('should require symbol parameter', async () => {
      const { req, res } = createReqRes({
        method: 'POST',
        body: {},
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data.error).toContain('Symbol required');
    });

    it('should add symbol to watchlist', async () => {
      const { req, res } = createReqRes({
        method: 'POST',
        body: { symbol: 'aapl' },
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.data.symbol).toBe('AAPL');
      expect(res.data.user_email).toBe('user@example.com');
      expect(supabaseRows).toHaveLength(1);
    });

    it('should normalize symbol to uppercase', async () => {
      const { req, res } = createReqRes({
        method: 'POST',
        body: { symbol: 'tsla' },
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.data.symbol).toBe('TSLA');
    });

    it('should trim whitespace from symbols', async () => {
      const { req, res } = createReqRes({
        method: 'POST',
        body: { symbol: '  nvda  ' },
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.data.symbol).toBe('NVDA');
    });

    it('should reject duplicate symbols in watchlist', async () => {
      supabaseRows.push({
        id: 'w-1',
        user_email: 'user@example.com',
        symbol: 'AAPL',
        added_at: '2026-01-01T00:00:00.000Z',
      });

      const { req, res } = createReqRes({
        method: 'POST',
        body: { symbol: 'aapl' },
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.data.error).toContain('already in watchlist');
    });

    it('should reject symbols with invalid characters', async () => {
      const { req, res } = createReqRes({
        method: 'POST',
        body: { symbol: 'AA@PL' },
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data.error).toContain('Invalid symbol format');
    });

    it('should reject overly long symbols', async () => {
      const { req, res } = createReqRes({
        method: 'POST',
        body: { symbol: 'AAPL123456' },
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data.error).toContain('Invalid symbol format');
    });

    it('should allow same symbol for different users', async () => {
      supabaseRows.push({
        id: 'w-1',
        user_email: 'other@example.com',
        symbol: 'AAPL',
        added_at: '2026-01-01T00:00:00.000Z',
      });

      const { req, res } = createReqRes({
        method: 'POST',
        body: { symbol: 'aapl' },
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(supabaseRows).toHaveLength(2);
    });
  });

  describe('DELETE: remove symbol from watchlist', () => {
    it('should require authentication', async () => {
      const { req, res } = createReqRes({
        method: 'DELETE',
        query: { symbol: 'AAPL' },
        cookie: '',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.data.error).toContain('Authentication required');
    });

    it('should require symbol parameter', async () => {
      const { req, res } = createReqRes({
        method: 'DELETE',
        query: {},
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data.error).toContain('Symbol required');
    });

    it('should remove symbol from watchlist', async () => {
      supabaseRows.push({
        id: 'w-1',
        user_email: 'user@example.com',
        symbol: 'AAPL',
        added_at: '2026-01-01T00:00:00.000Z',
      });

      const { req, res } = createReqRes({
        method: 'DELETE',
        query: { symbol: 'AAPL' },
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data.ok).toBe(true);
      expect(supabaseRows).toHaveLength(0);
    });

    it('should handle case-insensitive symbol removal', async () => {
      supabaseRows.push({
        id: 'w-1',
        user_email: 'user@example.com',
        symbol: 'MSFT',
        added_at: '2026-01-01T00:00:00.000Z',
      });

      const { req, res } = createReqRes({
        method: 'DELETE',
        query: { symbol: 'msft' },
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(supabaseRows).toHaveLength(0);
    });

    it('should gracefully handle deleting nonexistent symbol', async () => {
      const { req, res } = createReqRes({
        method: 'DELETE',
        query: { symbol: 'FAKE' },
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data.ok).toBe(true);
    });

    it('should only delete from authenticated user watchlist', async () => {
      supabaseRows.push(
        {
          id: 'w-1',
          user_email: 'user@example.com',
          symbol: 'AAPL',
          added_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'w-2',
          user_email: 'other@example.com',
          symbol: 'AAPL',
          added_at: '2026-01-01T00:00:00.000Z',
        }
      );

      const { req, res } = createReqRes({
        method: 'DELETE',
        query: { symbol: 'AAPL' },
        cookie: 'epiphany_session=valid',
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(supabaseRows).toHaveLength(1);
      expect(supabaseRows[0].user_email).toBe('other@example.com');
    });
  });

  describe('E2E watchlist operations', () => {
    it('should handle complete watchlist workflow', async () => {
      // Add AAPL
      const { req: addReq1, res: addRes1 } = createReqRes({
        method: 'POST',
        body: { symbol: 'aapl' },
        cookie: 'epiphany_session=valid',
      });
      await handler(addReq1, addRes1);
      expect(addRes1.status).toHaveBeenCalledWith(201);

      // Add MSFT
      const { req: addReq2, res: addRes2 } = createReqRes({
        method: 'POST',
        body: { symbol: 'msft' },
        cookie: 'epiphany_session=valid',
      });
      await handler(addReq2, addRes2);
      expect(addRes2.status).toHaveBeenCalledWith(201);

      // List watchlist
      const { req: listReq, res: listRes } = createReqRes({
        method: 'GET',
        cookie: 'epiphany_session=valid',
      });
      await handler(listReq, listRes);
      expect(listRes.data).toHaveLength(2);

      // Remove AAPL
      const { req: delReq, res: delRes } = createReqRes({
        method: 'DELETE',
        query: { symbol: 'AAPL' },
        cookie: 'epiphany_session=valid',
      });
      await handler(delReq, delRes);
      expect(delRes.status).toHaveBeenCalledWith(200);

      // Verify MSFT remains
      const { req: finalListReq, res: finalListRes } = createReqRes({
        method: 'GET',
        cookie: 'epiphany_session=valid',
      });
      await handler(finalListReq, finalListRes);
      expect(finalListRes.data).toHaveLength(1);
      expect(finalListRes.data[0].symbol).toBe('MSFT');
    });
  });

  it('should return 405 for unsupported methods', async () => {
    const { req, res } = createReqRes({
      method: 'PATCH',
      cookie: 'epiphany_session=valid',
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.data.error).toContain('not allowed');
  });
});
