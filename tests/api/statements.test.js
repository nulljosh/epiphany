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

// Statement PDFs live in Vercel Blob (private), not KV — KV only holds the
// metadata list now. Blob is stubbed in-memory so the handler's put/get/del
// round-trip is exercised without network.
const blobStore = new Map();
vi.mock('../../server/api/_blob.js', () => ({
  put: vi.fn((pathname, buffer) => {
    const url = `https://blob.test/${pathname}`;
    blobStore.set(url, Buffer.from(buffer));
    return Promise.resolve({ url, pathname });
  }),
  del: vi.fn((url) => { blobStore.delete(url); return Promise.resolve(); }),
  get: vi.fn((url) => {
    const buffer = blobStore.get(url);
    if (!buffer) return Promise.resolve(null);
    return Promise.resolve({
      stream: (async function* stream() { yield buffer; })(),
    });
  }),
}));

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

  // The one that actually matters: these are bank statements. A public blob URL
  // is a data breach, and 'public' is the value the avatar endpoint uses, so
  // it's exactly the wrong thing to copy-paste. Fail loudly if it regresses.
  it('stores the PDF as a private blob, never public', async () => {
    const { put } = await import('../../server/api/_blob.js');
    await handler(
      mockReq({
        method: 'POST',
        query: { action: 'upload' },
        body: { filename: 'feb.pdf', contentBase64: Buffer.from('pdf-bytes').toString('base64') },
      }),
      mockRes()
    );

    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][2]).toMatchObject({ access: 'private' });
    // And the raw PDF must not have been written into KV alongside it.
    expect([...store.keys()].some((k) => k.startsWith('statement-file:'))).toBe(false);
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

  // Regression: an unparseable PDF made summarizeStatementBuffer return a null
  // spendingMonth, and the dedupe filter dereferenced `.month` on it -> 500. The
  // upload was lost and its blob orphaned, which is what "June/July never landed"
  // looked like from the client.
  it('still stores a statement whose PDF could not be parsed', async () => {
    summarizeStatementBuffer.mockResolvedValueOnce({ spendingMonth: null, transactions: [] });
    const req = mockReq({
      method: 'POST',
      query: { action: 'upload' },
      body: { filename: 'jun.pdf', contentBase64: Buffer.from('unreadable').toString('base64') },
    });
    const res = mockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.statements).toHaveLength(1);
    expect(res.body.statements[0].filename).toBe('jun.pdf');
    expect(res.body.statements[0].spendingMonth).toBeTruthy();
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
