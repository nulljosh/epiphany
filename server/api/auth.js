import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { parseCookies, getSessionUser, errorResponse } from './auth-helpers.js';

// In-memory rate limiter for login attempts
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const SESSION_TTL = 30 * 24 * 60 * 60; // 30 days
const VERIFY_TTL = 24 * 60 * 60; // 24 hours
const DEFAULT_BASE_URL = 'https://opticon-production.vercel.app';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', [
    `opticon_session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL}; SameSite=Lax${secure ? '; Secure' : ''}`,
  ]);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', [
    'opticon_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
  ]);
}

function getBaseUrl() {
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : DEFAULT_BASE_URL;
}

export default async function handler(req, res) {
  const { action } = req.query;

  // GET: check current session
  if (req.method === 'GET' && action === 'me') {
    const session = await getSessionUser(req);
    if (!session) {
      return res.status(200).json({ authenticated: false });
    }
    const user = await kv.get(`user:${session.email}`);
    return res.status(200).json({
      authenticated: true,
      user: {
        id: user?.id,
        email: session.email,
        verified: user?.verified ?? false,
        tier: user?.tier || 'free',
        stripeCustomerId: user?.stripeCustomerId || null,
        watchlist: user?.watchlist || null,
      },
    });
  }

  if (req.method !== 'POST') {
    return errorResponse(res, 405, 'Method not allowed');
  }

  // POST: register
  if (action === 'register') {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return errorResponse(res, 400, 'Email and password required');
    }
    if (password.length < 8) {
      return errorResponse(res, 400, 'Password must be at least 8 characters');
    }

    const existing = await kv.get(`user:${email.toLowerCase()}`);
    if (existing) {
      return errorResponse(res, 409, 'Account already exists');
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const verifyToken = generateToken();

    const user = {
      id,
      email: email.toLowerCase(),
      passwordHash,
      verified: false,
      tier: 'free',
      stripeCustomerId: null,
      watchlist: null,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`user:${email.toLowerCase()}`, user);
    await kv.set(`verify:${verifyToken}`, { email: email.toLowerCase() }, { ex: VERIFY_TTL });

    // Create session immediately (allow usage before verification)
    const sessionToken = generateToken();
    const session = {
      userId: id,
      email: email.toLowerCase(),
      tier: 'free',
      expiresAt: Date.now() + SESSION_TTL * 1000,
    };
    await kv.set(`session:${sessionToken}`, session, { ex: SESSION_TTL });
    setSessionCookie(res, sessionToken);

    const verifyUrl = `${getBaseUrl()}/api/auth?action=verify-email&token=${verifyToken}`;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUTH] Verify email for ${email}: ${verifyUrl}`);
    }

    return res.status(201).json({
      ok: true,
      user: { id, email: email.toLowerCase(), verified: false, tier: 'free' },
      verifyUrl: process.env.NODE_ENV !== 'production' ? verifyUrl : undefined,
    });
  }

  // POST: login
  if (action === 'login') {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return errorResponse(res, 429, 'Too many login attempts. Try again in 15 minutes.');
    }

    const { email, password } = req.body || {};
    if (!email || !password) {
      return errorResponse(res, 400, 'Email and password required');
    }

    const user = await kv.get(`user:${email.toLowerCase()}`);
    if (!user) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    const sessionToken = generateToken();
    const session = {
      userId: user.id,
      email: user.email,
      tier: user.tier || 'free',
      expiresAt: Date.now() + SESSION_TTL * 1000,
    };
    await kv.set(`session:${sessionToken}`, session, { ex: SESSION_TTL });
    setSessionCookie(res, sessionToken);

    return res.status(200).json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        verified: user.verified,
        tier: user.tier || 'free',
        stripeCustomerId: user.stripeCustomerId || null,
      },
    });
  }

  // GET (handled via query): verify email
  if (action === 'verify-email') {
    const { token } = req.method === 'GET' ? req.query : (req.body || {});
    if (!token) {
      return errorResponse(res, 400, 'Verification token required');
    }

    const verification = await kv.get(`verify:${token}`);
    if (!verification) {
      return errorResponse(res, 400, 'Invalid or expired verification token');
    }

    const user = await kv.get(`user:${verification.email}`);
    if (user) {
      user.verified = true;
      await kv.set(`user:${verification.email}`, user);
    }
    await kv.del(`verify:${token}`);

    res.writeHead(302, { Location: `${getBaseUrl()}?verified=1` });
    return res.end();
  }

  // POST: logout
  if (action === 'logout') {
    const cookies = parseCookies(req);
    const token = cookies.opticon_session;
    if (token) {
      await kv.del(`session:${token}`);
    }
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  return errorResponse(res, 400, 'Unknown action');
}
