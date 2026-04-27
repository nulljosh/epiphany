// POST /api/broker/ws-signal
// Places a market order on Wealthsimple Trade via stored tokens
// Body: { symbol, side: "buy"|"sell", qty?, userId }

import { kv } from '../_kv.js';

const TRADE_BASE = 'https://trade-service.wealthsimple.com';
const AUTH_BASE = 'https://api.production.wealthsimple.com/v1/oauth/v2/token';
const CLIENT_ID = '4da53ac2b03225bed1af';

async function refreshTokens(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  const res = await fetch(AUTH_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error('Token refresh failed — re-authenticate via /api/broker/wealthsimple-auth');
  return res.json();
}

async function resolveSecurityId(ticker, accessToken) {
  const res = await fetch(`${TRADE_BASE}/securities?query=${encodeURIComponent(ticker)}&limit=5`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Security lookup failed for ${ticker}`);
  const data = await res.json();
  const results = data.results || data;
  const match = results.find(s => s.stock?.symbol === ticker.toUpperCase()) || results[0];
  if (!match) throw new Error(`No Wealthsimple security found for ${ticker}`);
  return match.id;
}

async function placeOrder({ accessToken, accountId, securityId, side, qty }) {
  const res = await fetch(`${TRADE_BASE}/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_id: accountId,
      security_id: securityId,
      quantity: qty,
      order_type: side === 'buy' ? 'buy_quantity' : 'sell_quantity',
      order_sub_type: 'market',
      time_in_force: 'day',
    }),
  });
  return { res, data: await res.json() };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { symbol, side, qty = 1, userId } = req.body || {};
  if (!symbol || !side || !userId) return res.status(400).json({ error: 'Missing symbol, side, or userId' });
  if (!['buy', 'sell'].includes(side)) return res.status(400).json({ error: 'side must be buy or sell' });

  const raw = await kv.get(`ws:tokens:${userId}`);
  if (!raw) return res.status(401).json({ error: 'No Wealthsimple session — authenticate first via /api/broker/wealthsimple-auth' });

  let tokens = typeof raw === 'string' ? JSON.parse(raw) : raw;

  try {
    const securityId = await resolveSecurityId(symbol, tokens.accessToken);
    let { res: orderRes, data } = await placeOrder({ ...tokens, securityId, side, qty });

    // If expired, refresh and retry once
    if (orderRes.status === 401) {
      const refreshed = await refreshTokens(tokens.refreshToken);
      tokens.accessToken = refreshed.access_token;
      tokens.refreshToken = refreshed.refresh_token;
      await kv.set(`ws:tokens:${userId}`, JSON.stringify(tokens), { ex: 86400 });
      const retry = await placeOrder({ ...tokens, securityId, side, qty });
      orderRes = retry.res;
      data = retry.data;
    }

    if (!orderRes.ok) throw new Error(data.message || JSON.stringify(data));
    console.log('[WS-SIGNAL] Order placed:', data.order_id, symbol, side, qty);
    return res.status(200).json({ ok: true, orderId: data.order_id });
  } catch (err) {
    console.error('[WS-SIGNAL]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
