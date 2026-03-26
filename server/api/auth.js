import { getKv } from './_kv.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { parseCookies, getSessionUser, errorResponse } from './auth-helpers.js';
import { supabaseRequest, supabaseConfigured } from './supabase.js';
import { sendEmail } from './_email.js';

const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX = 15;

async function checkRateLimit(kv, ip) {
  const now = Date.now();
  const key = `ratelimit:${ip}`;
  const entry = await kv.get(key);

  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
    await kv.set(key, { count: 1, firstAttempt: now }, { ex: RATE_LIMIT_WINDOW / 1000 });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;

  const next = { count: entry.count + 1, firstAttempt: entry.firstAttempt };
  await kv.set(key, next, { ex: RATE_LIMIT_WINDOW / 1000 });
  return true;
}

const SESSION_TTL = 30 * 24 * 60 * 60; // 30 days
const VERIFY_TTL = 24 * 60 * 60; // 24 hours
const RESET_TTL = 60 * 60; // 1 hour
const DEFAULT_BASE_URL = 'https://monica.heyitsmejosh.com';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', [
    `monica_session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL}; SameSite=Lax${secure ? '; Secure' : ''}`,
  ]);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', [
    'monica_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
  ]);
}

function getBaseUrl() {
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : DEFAULT_BASE_URL;
}

function publicUser(user) {
  return {
    id: user?.id,
    email: user?.email,
    name: user?.name || user?.fullName || null,
    verified: user?.verified ?? false,
    tier: user?.tier || 'free',
    stripeCustomerId: user?.stripeCustomerId || null,
    watchlist: user?.watchlist || null,
    avatarUrl: user?.avatarUrl || null,
  };
}

async function requireAuthenticatedUser(req, kv) {
  const session = await getSessionUser(req);
  if (!session) return { session: null, user: null };
  const user = await kv.get(`user:${session.email}`);
  return { session, user };
}

async function updateCurrentSession(req, kv, updater) {
  const cookies = parseCookies(req);
  const token = cookies.monica_session;
  if (!token) return;
  const sessionKey = `session:${token}`;
  const current = await kv.get(sessionKey);
  if (!current) return;
  const next = updater(current) || current;
  await kv.set(sessionKey, next, { ex: SESSION_TTL });
}

async function migrateSupabaseEmail(oldEmail, newEmail) {
  if (!supabaseConfigured()) return;

  await Promise.all([
    supabaseRequest(`watchlists?user_email=eq.${encodeURIComponent(oldEmail)}`, {
      method: 'PATCH',
      body: { user_email: newEmail },
    }),
    supabaseRequest(`alerts?user_email=eq.${encodeURIComponent(oldEmail)}`, {
      method: 'PATCH',
      body: { user_email: newEmail },
    }),
    supabaseRequest(`portfolio_history?user_email=eq.${encodeURIComponent(oldEmail)}`, {
      method: 'PATCH',
      body: { user_email: newEmail },
    }),
  ]);
}

async function deleteSupabaseUserData(email) {
  if (!supabaseConfigured()) return;

  await Promise.all([
    supabaseRequest(`watchlists?user_email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' }),
    supabaseRequest(`alerts?user_email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' }),
    supabaseRequest(`portfolio_history?user_email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' }),
  ]);
}

export default async function handler(req, res) {
  const kv = await getKv();
  const { action } = req.query;

  // GET: check current session
  if (req.method === 'GET' && action === 'me') {
    try {
      const session = await getSessionUser(req);
      if (!session) {
        return res.status(200).json({ authenticated: false });
      }
      const user = await kv.get(`user:${session.email}`);
      return res.status(200).json({
        authenticated: true,
        user: publicUser(user || { email: session.email, tier: session.tier }),
      });
    } catch (err) {
      console.error('[AUTH] Session check failed:', err.message);
      return res.status(200).json({ authenticated: false });
    }
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

    try {
      const normalizedEmail = email.toLowerCase();
      const existing = await kv.get(`user:${normalizedEmail}`);
      if (existing) {
        return errorResponse(res, 409, 'Account already exists');
      }

      const id = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 10);
      const verifyToken = generateToken();

      const user = {
        id,
        email: normalizedEmail,
        passwordHash,
        verified: false,
        tier: 'free',
        stripeCustomerId: null,
        watchlist: null,
        createdAt: new Date().toISOString(),
      };

      await kv.set(`user:${normalizedEmail}`, user);
      await kv.set(`verify:${verifyToken}`, { email: normalizedEmail }, { ex: VERIFY_TTL });

      const sessionToken = generateToken();
      const session = {
        userId: id,
        email: normalizedEmail,
        tier: 'free',
        expiresAt: Date.now() + SESSION_TTL * 1000,
      };
      await kv.set(`session:${sessionToken}`, session, { ex: SESSION_TTL });
      setSessionCookie(res, sessionToken);

      const verifyUrl = `${getBaseUrl()}/api/auth?action=verify-email&token=${verifyToken}`;
      sendEmail({
        to: normalizedEmail,
        subject: 'Verify your Monica account',
        html: `<p>Click <a href="${verifyUrl}">here</a> to verify your email address.</p><p>Or copy this link: ${verifyUrl}</p>`,
      }).catch((err) => console.warn('[AUTH] Verification email failed:', err.message));

      return res.status(201).json({
        ok: true,
        user: publicUser(user),
      });
    } catch (err) {
      console.error('[AUTH] Register KV error:', err.message);
      return errorResponse(res, 503, 'Service temporarily unavailable');
    }
  }

  // POST: login
  if (action === 'login') {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    if (!(await checkRateLimit(kv, clientIp))) {
      return errorResponse(res, 429, 'Too many login attempts. Try again in 15 minutes.');
    }

    const { email, password } = req.body || {};
    if (!email || !password) {
      return errorResponse(res, 400, 'Email and password required');
    }

    try {
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
        user: publicUser(user),
      });
    } catch (err) {
      console.error('[AUTH] Login KV error:', err.message);
      return errorResponse(res, 503, 'Service temporarily unavailable');
    }
  }

  // POST: Sign in with Apple
  if (action === 'signin-apple') {
    const { identityToken, email, fullName } = req.body || {};
    if (!identityToken) {
      return errorResponse(res, 400, 'Identity token required');
    }

    try {
      // Decode Apple JWT payload (base64url)
      const parts = identityToken.split('.');
      if (parts.length !== 3) return errorResponse(res, 400, 'Invalid token format');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      const appleUserId = payload.sub;
      const appleEmail = payload.email || email;

      if (!appleUserId) return errorResponse(res, 400, 'Invalid Apple token');

      // Check if Apple ID is already linked
      let user = await kv.get(`apple:${appleUserId}`);

      if (!user && appleEmail) {
        // Check if email account exists -- link it
        const existingUser = await kv.get(`user:${appleEmail.toLowerCase()}`);
        if (existingUser) {
          existingUser.appleId = appleUserId;
          await kv.set(`user:${appleEmail.toLowerCase()}`, existingUser);
          await kv.set(`apple:${appleUserId}`, existingUser);
          user = existingUser;
        }
      }

      if (!user) {
        // Create new account
        const newEmail = appleEmail || `${appleUserId}@privaterelay.appleid.com`;
        const id = crypto.randomUUID();
        user = {
          id,
          email: newEmail,
          passwordHash: null,
          tier: 'free',
          verified: true,
          appleId: appleUserId,
          fullName: fullName || null,
          createdAt: Date.now(),
        };
        await kv.set(`user:${newEmail.toLowerCase()}`, user);
        await kv.set(`apple:${appleUserId}`, user);
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
        user: publicUser(user),
      });
    } catch (err) {
      console.error('[AUTH] Apple sign-in error:', err.message);
      return errorResponse(res, 500, 'Apple sign-in failed');
    }
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

  // POST: forgot-password
  if (action === 'forgot-password') {
    const { email } = req.body || {};
    const genericMsg = 'If an account exists with that email, a reset link has been generated.';
    if (!email) {
      return errorResponse(res, 400, 'Email is required');
    }
    try {
      const user = await kv.get(`user:${email.toLowerCase()}`);
      if (user) {
        const resetToken = generateToken();
        await kv.set(`reset:${resetToken}`, { email: email.toLowerCase() }, { ex: RESET_TTL });
        const resetUrl = `${getBaseUrl()}/reset?token=${resetToken}`;
        sendEmail({
          to: email.toLowerCase(),
          subject: 'Reset your Monica password',
          html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p><p>Or copy this link: ${resetUrl}</p>`,
        }).catch((err) => console.warn('[AUTH] Reset email failed:', err.message));
      }
    } catch {
      // Always return generic message.
    }
    return res.status(200).json({ ok: true, message: genericMsg });
  }

  // POST: reset-password
  if (action === 'reset-password') {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return errorResponse(res, 400, 'Token and new password are required');
    }
    if (password.length < 8) {
      return errorResponse(res, 400, 'Password must be at least 8 characters');
    }
    const resetData = await kv.get(`reset:${token}`);
    if (!resetData) {
      return errorResponse(res, 400, 'Invalid or expired reset token');
    }
    const user = await kv.get(`user:${resetData.email}`);
    if (!user) {
      return errorResponse(res, 400, 'Invalid or expired reset token');
    }
    user.passwordHash = await bcrypt.hash(password, 10);
    await kv.set(`user:${resetData.email}`, user);
    await kv.del(`reset:${token}`);
    return res.status(200).json({ ok: true, message: 'Password has been reset successfully' });
  }

  // POST: change-password
  if (action === 'change-password') {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return errorResponse(res, 400, 'Current password and new password are required');
    }
    if (newPassword.length < 8) {
      return errorResponse(res, 400, 'Password must be at least 8 characters');
    }

    const { user } = await requireAuthenticatedUser(req, kv);
    if (!user) {
      return errorResponse(res, 401, 'Authentication required');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return errorResponse(res, 401, 'Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await kv.set(`user:${user.email}`, user);
    return res.status(200).json({ ok: true, message: 'Password updated successfully', user: publicUser(user) });
  }

  // POST: change-email
  if (action === 'change-email') {
    const { newEmail, password } = req.body || {};
    if (!newEmail || !password) {
      return errorResponse(res, 400, 'New email and password are required');
    }

    const normalizedEmail = newEmail.toLowerCase().trim();
    if (!normalizedEmail.includes('@')) {
      return errorResponse(res, 400, 'Valid email required');
    }

    const { session, user } = await requireAuthenticatedUser(req, kv);
    if (!session || !user) {
      return errorResponse(res, 401, 'Authentication required');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return errorResponse(res, 401, 'Password is incorrect');
    }
    if (normalizedEmail === user.email) {
      return errorResponse(res, 400, 'New email must be different');
    }

    const existing = await kv.get(`user:${normalizedEmail}`);
    if (existing) {
      return errorResponse(res, 409, 'Account already exists');
    }

    const previousEmail = user.email;
    user.email = normalizedEmail;
    await kv.set(`user:${normalizedEmail}`, user);
    await kv.del(`user:${previousEmail}`);
    await updateCurrentSession(req, kv, (current) => ({ ...current, email: normalizedEmail }));

    try {
      await migrateSupabaseEmail(previousEmail, normalizedEmail);
    } catch (err) {
      console.error('[AUTH] Email migration error:', err.message);
      user.email = previousEmail;
      await kv.set(`user:${previousEmail}`, user);
      await kv.del(`user:${normalizedEmail}`);
      await updateCurrentSession(req, kv, (current) => ({ ...current, email: previousEmail }));
      return errorResponse(res, 503, 'Failed to migrate account data');
    }

    return res.status(200).json({ ok: true, message: 'Email updated successfully', user: publicUser(user) });
  }

  // POST: delete-account
  if (action === 'delete-account') {
    const { password } = req.body || {};
    if (!password) {
      return errorResponse(res, 400, 'Password is required');
    }

    const { session, user } = await requireAuthenticatedUser(req, kv);
    if (!session || !user) {
      return errorResponse(res, 401, 'Authentication required');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return errorResponse(res, 401, 'Password is incorrect');
    }

    try {
      await deleteSupabaseUserData(user.email);
    } catch (err) {
      console.error('[AUTH] Delete Supabase data error:', err.message);
      return errorResponse(res, 503, 'Failed to delete account data');
    }

    const cookies = parseCookies(req);
    const token = cookies.monica_session;
    if (token) {
      await kv.del(`session:${token}`);
    }
    await kv.del(`portfolio:${user.id}`);
    await kv.del(`user:${user.email}`);
    clearSessionCookie(res);
    return res.status(200).json({ ok: true, message: 'Account deleted successfully' });
  }

  // POST: change-name
  if (action === 'change-name') {
    const { name } = req.body || {};
    if (!name || !name.trim()) {
      return errorResponse(res, 400, 'Name is required');
    }

    const { user } = await requireAuthenticatedUser(req, kv);
    if (!user) {
      return errorResponse(res, 401, 'Authentication required');
    }

    user.name = name.trim();
    await kv.set(`user:${user.email}`, user);
    return res.status(200).json({ ok: true, user: publicUser(user) });
  }

  // POST: logout
  if (action === 'logout') {
    const cookies = parseCookies(req);
    const token = cookies.monica_session;
    if (token) {
      await kv.del(`session:${token}`);
    }
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  return errorResponse(res, 400, 'Unknown action');
}
