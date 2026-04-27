// POST /api/broker/wealthsimple-auth
// Handles Wealthsimple OAuth2 password grant + OTP step
// Stores tokens in KV (Upstash) keyed per user session
//
// Step 1: POST { email, password }
//   - If OTP required: returns { otpRequired: true }
//   - If success: returns { ok: true, accountId }
//
// Step 2: POST { email, password, otp: "123456" }
//   - Returns { ok: true, accountId }
//
// Tokens are stored in KV as ws:tokens:<userId> and read by /api/broker/ws-signal.js

import { kv } from '../_kv.js';

const AUTH_BASE = 'https://api.production.wealthsimple.com/v1/oauth/v2/token';
const TRADE_BASE = 'https://trade-service.wealthsimple.com';
const CLIENT_ID = '4da53ac2b03225bed1af';

async function wsAuth(email, password, otp) {
  const body = new URLSearchParams({
    grant_type: 'password',
    username: email,
    password,
    client_id: CLIENT_ID,
    scope: 'invest.read invest.write',
    ...(otp ? { otp } : {}),
  });

  const res = await fetch(AUTH_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (res.status === 401) {
    const otpHeader = res.headers.get('x-wealthsimple-otp');
    if (otpHeader) return { otpRequired: true };
    throw new Error('Invalid credentials');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function getDefaultAccountId(accessToken) {
  const res = await fetch(`${TRADE_BASE}/account/list`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const accounts = data.results || data;
  const account = accounts.find(a => a.account_type === 'ca_tfsa')
    || accounts.find(a => a.account_type === 'ca_rrsp')
    || accounts[0];
  return account?.id || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, otp, userId } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  if (!userId) return res.status(400).json({ error: 'Missing userId (for token storage)' });

  try {
    const result = await wsAuth(email, password, otp);

    if (result.otpRequired) {
      return res.status(200).json({ otpRequired: true });
    }

    const { access_token, refresh_token } = result;
    const accountId = await getDefaultAccountId(access_token);

    // Store in KV — expires in 24h (access tokens last ~30min, refresh tokens last longer)
    await kv.set(`ws:tokens:${userId}`, JSON.stringify({
      accessToken: access_token,
      refreshToken: refresh_token,
      accountId,
      connectedAt: Date.now(),
    }), { ex: 86400 });

    return res.status(200).json({ ok: true, accountId });
  } catch (err) {
    console.error('[WS-AUTH]', err.message);
    return res.status(401).json({ error: err.message });
  }
}
