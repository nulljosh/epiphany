import { kv } from '@vercel/kv';

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((cookies, pair) => {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key] = rest.join('=');
    return cookies;
  }, {});
}

export async function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies.opticon_session;
  if (!token) return null;
  const session = await kv.get(`session:${token}`);
  if (!session) return null;
  if (session.expiresAt && Date.now() > session.expiresAt) {
    await kv.del(`session:${token}`);
    return null;
  }
  return session;
}

export function errorResponse(res, status, message) {
  return res.status(status).json({ error: message });
}
