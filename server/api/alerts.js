import { sparkRequest, sparkConfigured } from './spark.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';
import { fetchYahooBatch } from './stocks-free.js';

export const KINDS = ['price', 'move', 'high52', 'low52', 'earnings', 'digest'];

/** The stored target and direction for a kind. 52 week alerts are price alerts pinned to today's high or low. */
export function alertTarget(kind, quote, body) {
  if (kind === 'price') return { target_price: Number(body.target_price), direction: body.direction };
  // A move alert stores its percent in target_price: fire on a day's move that big, up or down.
  if (kind === 'move') return { target_price: Number(body.target_price), direction: 'above' };
  if (kind === 'high52') return quote?.fiftyTwoWeekHigh ? { target_price: quote.fiftyTwoWeekHigh, direction: 'above' } : null;
  if (kind === 'low52') return quote?.fiftyTwoWeekLow ? { target_price: quote.fiftyTwoWeekLow, direction: 'below' } : null;
  if (kind === 'digest') return { target_price: 0, direction: 'above' };
  return quote?.nextEarnings ? { target_price: 0, direction: 'above' } : null;
}

export default async function handler(req, res) {
  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');
  if (!sparkConfigured()) return errorResponse(res, 503, 'Database not configured');

  const email = session.email;

  // GET: list alerts
  if (req.method === 'GET') {
    const rows = await sparkRequest(
      `alerts?user_email=eq.${encodeURIComponent(email)}&select=*&order=created_at.desc`
    );
    return res.status(200).json(rows || []);
  }

  // POST: create alert
  if (req.method === 'POST') {
    const body = req.body || {};
    const kind = body.kind || 'price';
    // The weekly earnings email covers the whole watchlist, so it has no symbol of its own.
    const symbol = kind === 'digest' ? 'WATCHLIST' : String(body.symbol || '').toUpperCase().trim();
    if (!symbol || !KINDS.includes(kind)) return res.status(400).json({ error: 'symbol and a known kind required' });
    if (kind === 'price' && (!body.target_price || !['above', 'below'].includes(body.direction))) {
      return res.status(400).json({ error: 'target_price and direction ("above" or "below") required' });
    }
    if (kind === 'move' && !(Number(body.target_price) > 0)) return res.status(400).json({ error: 'target_price (a percent) required' });

    const quote = kind === 'price' || kind === 'move' || kind === 'digest' ? null : (await fetchYahooBatch([symbol]))?.[0];
    const target = alertTarget(kind, quote, body);
    if (!target) return res.status(400).json({ error: kind === 'earnings' ? `No earnings date for ${symbol}` : `No 52 week range for ${symbol}` });

    const rows = await sparkRequest('alerts', {
      method: 'POST',
      body: { user_email: email, symbol, kind, ...target },
    });
    return res.status(201).json(Array.isArray(rows) ? rows[0] : rows);
  }

  // DELETE: remove alert by id
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Alert id required' });

    await sparkRequest(
      `alerts?id=eq.${encodeURIComponent(id)}&user_email=eq.${encodeURIComponent(email)}`,
      { method: 'DELETE' }
    );
    return res.status(200).json({ ok: true });
  }

  return errorResponse(res, 405, 'Method not allowed');
}
