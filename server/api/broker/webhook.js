import { applyCors } from '../_cors.js';
// TradingView alert → Alpaca paper order
// POST { ticker, action, price?, qty? }
const BASE = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets';

function alpacaHeaders() {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
    'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET || '',
    'Content-Type': 'application/json',
  };
}

export default async function handler(req, res) {
  applyCors(req, res, { methods: 'POST, OPTIONS' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { ticker, action, qty = 1 } = body || {};
  if (!ticker || !action) return res.status(400).json({ error: 'Missing ticker or action' });

  const side = action.toLowerCase() === 'sell' ? 'sell' : 'buy';

  if (!process.env.ALPACA_API_KEY) {
    console.log('[BROKER/WEBHOOK] No Alpaca key — received:', ticker, side, qty);
    return res.status(200).json({ ok: true, message: 'Signal logged (Alpaca not configured)' });
  }

  try {
    const r = await fetch(`${BASE}/v2/orders`, {
      method: 'POST',
      headers: alpacaHeaders(),
      body: JSON.stringify({ symbol: ticker.toUpperCase(), qty: String(qty), side, type: 'market', time_in_force: 'day' }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || `Alpaca ${r.status}`);
    console.log('[BROKER/WEBHOOK] Order placed:', data.id, ticker, side, qty);
    return res.status(200).json({ ok: true, order: data });
  } catch (err) {
    console.error('[BROKER/WEBHOOK] Error:', err.message);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
}
