import { del } from './_blob.js';
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
    // ponytail: avatars are generated, not uploaded — a few KB of SVG from the
    // web, a 200x200 JPEG from iOS — so they live inline on the user record as
    // a data URL. No blob store, no second thing to fail. The cap has plenty of
    // headroom over both; move back to blob storage only if real photo uploads
    // ever land here.
    if (buffer.length > 256 * 1024) {
      return errorResponse(res, 400, 'Image too large (max 256KB)');
    }

    const contentType = format === 'svg' ? 'image/svg+xml' : 'image/jpeg';
    const previousAvatarUrl = user.avatarUrl;
    const avatarUrl = `data:${contentType};base64,${image}`;

    user.avatarUrl = avatarUrl;
    user.avatarUpdatedAt = Date.now();
    try {
      await kv.set(`user:${session.email}`, user);
    } catch (err) {
      console.error('[avatar POST] KV set failed', { email: session.email, error: err?.message, stack: err?.stack });
      return errorResponse(res, 500, 'Failed to save avatar - please retry');
    }

    // Clean up the old blob-hosted avatar, if this user still had one.
    if (previousAvatarUrl && previousAvatarUrl.startsWith('http')) {
      try {
        await del(previousAvatarUrl);
      } catch (err) {
        console.error('[avatar POST] old blob delete failed (non-fatal)', { avatarUrl: previousAvatarUrl, error: err?.message });
      }
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({ ok: true, avatarUrl });
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
      const previousAvatarUrl = user.avatarUrl;
      user.avatarUrl = null;
      try {
        await kv.set(`user:${session.email}`, user);
      } catch (err) {
        console.error('[avatar DELETE] KV set failed', { email: session.email, error: err?.message, stack: err?.stack });
        return errorResponse(res, 500, 'Failed to clear avatar');
      }
      // Clear the pointer first: a failed KV write must not leave the profile
      // aimed at a blob that no longer exists.
      try {
        if (previousAvatarUrl.startsWith('http')) await del(previousAvatarUrl);
      } catch (err) {
        console.error('[avatar DELETE] blob delete failed (non-fatal)', { avatarUrl: previousAvatarUrl, error: err?.message });
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
