import { describe, it, expect, beforeEach, vi } from 'vitest';
import { del } from '../../server/api/_blob.js';
import handler from '../../server/api/avatar.js';
import { createMockKV, createReqRes, seedUser, resetAllMocks, getKVStore } from './_mocks.js';

// Records the order blob calls happen in, so put-before-delete is assertable.
const callOrder = [];

vi.mock('../../server/api/_blob.js', () => ({
  put: vi.fn(async (pathname) => {
    callOrder.push('put');
    return { url: `https://blob.vercel-storage.com/${pathname}` };
  }),
  del: vi.fn(async () => {
    callOrder.push('del');
  }),
}));

const mockKv = createMockKV();
vi.mock('../../server/api/_kv.js', () => ({
  getKv: vi.fn(async () => mockKv),
}));

vi.mock('../../server/api/auth-helpers.js', () => ({
  getSessionUser: vi.fn(async () => ({ email: 'user@example.com' })),
  errorResponse: (res, status, message) => res.status(status).json({ error: message }),
}));

const OLD_URL = 'https://blob.vercel-storage.com/avatars/user-1-old.jpg';

function postAvatar() {
  const { req, res } = createReqRes({
    method: 'POST',
    body: { image: Buffer.from('fake-image').toString('base64'), format: 'jpg' },
  });
  return { req, res, run: () => handler(req, res) };
}

describe('avatar API — destructive ops never precede the durable write', () => {
  beforeEach(() => {
    resetAllMocks();
    vi.clearAllMocks();
    callOrder.length = 0;
    seedUser({ avatarUrl: OLD_URL });
  });

  it('POST stores the image inline, then drops the legacy blob', async () => {
    const { res, run } = postAvatar();
    await run();

    expect(res.statusCode).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(res.data.avatarUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    // The regression: `del` used to run first, so a failed write destroyed the
    // only copy of the avatar for nothing.
    expect(getKVStore().get('user:user@example.com').avatarUrl).toBe(res.data.avatarUrl);
    expect(del).toHaveBeenCalledWith(OLD_URL);
  });

  it('POST rejects an image too large to inline', async () => {
    const { req, res } = createReqRes({
      method: 'POST',
      body: { image: Buffer.alloc(65 * 1024).toString('base64'), format: 'jpg' },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(getKVStore().get('user:user@example.com').avatarUrl).toBe(OLD_URL);
  });

  it('POST keeps the old avatar when the profile save fails', async () => {
    mockKv.set.mockRejectedValueOnce(new Error('kv down'));

    const { res, run } = postAvatar();
    await run();

    expect(res.statusCode).toBe(500);
    expect(del).not.toHaveBeenCalled();
  });

  it('DELETE clears the stored pointer before dropping the blob', async () => {
    const { req, res } = createReqRes({ method: 'DELETE' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(callOrder).toEqual(['del']);
    expect(getKVStore().get('user:user@example.com').avatarUrl).toBeNull();
  });

  it('DELETE leaves the blob alone when clearing the pointer fails', async () => {
    mockKv.set.mockRejectedValueOnce(new Error('kv down'));

    const { req, res } = createReqRes({ method: 'DELETE' });
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(del).not.toHaveBeenCalled();
  });
});
