import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../server/api/_cors.js', () => ({ applyCors: vi.fn() }));
vi.mock('../../server/api/_ratelimit.js', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock('../../server/api/auth-helpers.js', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ userId: 'user-1' }),
  errorResponse: (res, status, message) => res.status(status).json({ error: message }),
}));

const store = new Map();
const kvMock = {
  get: vi.fn((key) => Promise.resolve(store.get(key) ?? null)),
  set: vi.fn((key, value) => { store.set(key, value); return Promise.resolve('OK'); }),
  del: vi.fn((key) => { store.delete(key); return Promise.resolve(1); }),
};
vi.mock('../../server/api/_kv.js', () => ({ getKv: vi.fn().mockResolvedValue(kvMock) }));

vi.mock('../../server/api/statements-data.js', () => ({
  getStatementsPayload: vi.fn(),
  summarizeStatementBuffer: vi.fn().mockResolvedValue({
    spendingMonth: { month: 'Feb 2026', sortKey: '2026-02', total: 10 },
    transactions: [{ date: '2026-02-11', description: 'Test', amount: -10, category: 'food' }],
  }),
}));

const { checkRateLimit } = await import('../../server/api/_ratelimit.js');
const { summarizeStatementBuffer } = await import('../../server/api/statements-data.js');
const handler = (await import('../../server/api/statements.js')).default;

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
}

function mockReq({ method = 'GET', query = {}, body = {} } = {}) {
  return { method, query, body, headers: {}, socket: {} };
}

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue(true);
  summarizeStatementBuffer.mockResolvedValue({
    spendingMonth: { month: 'Feb 2026', sortKey: '2026-02', total: 10 },
    transactions: [{ date: '2026-02-11', description: 'Test', amount: -10, category: 'food' }],
  });
});

describe('statements upload handler', () => {
  it('uploads a new statement successfully', async () => {
    const req = mockReq({
      method: 'POST',
      query: { action: 'upload' },
      body: { filename: 'feb.pdf', contentBase64: Buffer.from('pdf-bytes').toString('base64') },
    });
    const res = mockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.statement.filename).toBe('feb.pdf');
    expect(res.body.statements).toHaveLength(1);
  });

  it('replaces the existing statement for the same month (dedup)', async () => {
    const upload = (filename) => handler(
      mockReq({
        method: 'POST',
        query: { action: 'upload' },
        body: { filename, contentBase64: Buffer.from('pdf-bytes').toString('base64') },
      }),
      mockRes()
    );

    await upload('feb-v1.pdf');
    const res2 = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        query: { action: 'upload' },
        body: { filename: 'feb-v2.pdf', contentBase64: Buffer.from('pdf-bytes').toString('base64') },
      }),
      res2
    );

    expect(res2.statusCode).toBe(200);
    expect(res2.body.statements).toHaveLength(1);
    expect(res2.body.statements[0].filename).toBe('feb-v2.pdf');
  });

  it('rejects upload missing filename or contentBase64', async () => {
    const req = mockReq({ method: 'POST', query: { action: 'upload' }, body: { filename: '' } });
    const res = mockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('rejects upload when rate limited', async () => {
    checkRateLimit.mockResolvedValueOnce(false);
    const req = mockReq({
      method: 'POST',
      query: { action: 'upload' },
      body: { filename: 'feb.pdf', contentBase64: 'abc' },
    });
    const res = mockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(429);
  });

  it('returns 401 when there is no session', async () => {
    const { getSessionUser } = await import('../../server/api/auth-helpers.js');
    getSessionUser.mockResolvedValueOnce(null);
    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
  });
});
