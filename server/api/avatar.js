import { put, del } from '@vercel/blob';
import { getKv } from './_kv.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';

export default async function handler(req, res) {
  const kv = await getKv();

  // GET: fetch avatar URL for a user
  if (req.method === 'GET') {
    const { userId } = req.query;
    if (!userId) return errorResponse(res, 400, 'userId is required');
    let user;
    try {
      user = await findUserById(kv, userId);
    } catch (err) {
      console.error('[avatar GET] KV lookup failed', { userId, error: err?.message, stack: err?.stack });
      return errorResponse(res, 500, 'Failed to look up avatar');
    }
    return res.status(200).json({ avatarUrl: user?.avatarUrl || null });
  }

  // POST: upload avatar (base64 JSON body)
  if (req.method === 'POST') {
    const session = await getSessionUser(req);
    if (!session) return errorResponse(res, 401, 'Authentication required');

    const { image, format } = req.body || {};
    if (!image) return errorResponse(res, 400, 'image (base64) is required');

    let user;
    try {
      user = await kv.get(`user:${session.email}`);
    } catch (err) {
      console.error('[avatar POST] KV get user failed', { email: session.email, error: err?.message, stack: err?.stack });
      return errorResponse(res, 500, 'Failed to load user');
    }
    if (!user) return errorResponse(res, 401, 'User not found');

    const buffer = Buffer.from(image, 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      return errorResponse(res, 400, 'Image too large (max 5MB)');
    }

    const isSvg = format === 'svg';
    const ext = isSvg ? 'svg' : 'jpg';
    const contentType = isSvg ? 'image/svg+xml' : 'image/jpeg';

    // Delete old avatar if exists
    if (user.avatarUrl) {
      try {
        await del(user.avatarUrl);
      } catch (err) {
        console.error('[avatar POST] old blob delete failed (non-fatal)', { avatarUrl: user.avatarUrl, error: err?.message });
      }
    }

    let blob;
    try {
      blob = await put(`avatars/${user.id}-${Date.now()}.${ext}`, buffer, {
        access: 'public',
        contentType,
        addRandomSuffix: false,
      });
    } catch (err) {
      console.error('[avatar POST] blob put failed', { userId: user.id, error: err?.message, stack: err?.stack });
      return errorResponse(res, 500, 'Failed to upload avatar (blob store error)');
    }

    user.avatarUrl = blob.url;
    user.avatarUpdatedAt = Date.now();
    try {
      await kv.set(`user:${session.email}`, user);
    } catch (err) {
      console.error('[avatar POST] KV set failed after successful blob upload', { email: session.email, avatarUrl: blob.url, error: err?.message, stack: err?.stack });
      return errorResponse(res, 500, 'Avatar uploaded but failed to save — please retry');
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({ ok: true, avatarUrl: blob.url });
  }

  // DELETE: remove avatar
  if (req.method === 'DELETE') {
    const session = await getSessionUser(req);
    if (!session) return errorResponse(res, 401, 'Authentication required');

    let user;
    try {
      user = await kv.get(`user:${session.email}`);
    } catch (err) {
      console.error('[avatar DELETE] KV get user failed', { email: session.email, error: err?.message, stack: err?.stack });
      return errorResponse(res, 500, 'Failed to load user');
    }
    if (!user) return errorResponse(res, 401, 'User not found');

    if (user.avatarUrl) {
      try {
        await del(user.avatarUrl);
      } catch (err) {
        console.error('[avatar DELETE] blob delete failed (non-fatal)', { avatarUrl: user.avatarUrl, error: err?.message });
      }
      user.avatarUrl = null;
      try {
        await kv.set(`user:${session.email}`, user);
      } catch (err) {
        console.error('[avatar DELETE] KV set failed', { email: session.email, error: err?.message, stack: err?.stack });
        return errorResponse(res, 500, 'Failed to clear avatar');
      }
    }

    return res.status(200).json({ ok: true });
  }

  return errorResponse(res, 405, 'Method not allowed');
}

async function findUserById(kv, userId) {
  // KV is keyed by email, so we scan -- this is only used for GET by userId
  // For production scale, maintain an index. For now, iterate.
  const keys = (await kv.keys('user:*')) || [];
  for (const key of keys) {
    const user = await kv.get(key);
    if (user?.id === userId) return user;
  }
  return null;
}
