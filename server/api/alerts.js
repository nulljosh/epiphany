import { supabaseRequest, supabaseConfigured } from './supabase.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';

export default async function handler(req, res) {
  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');
  if (!supabaseConfigured()) return errorResponse(res, 503, 'Database not configured');

  const email = session.email;

  // GET: list alerts
  if (req.method === 'GET') {
    const rows = await supabaseRequest(
      `alerts?user_email=eq.${encodeURIComponent(email)}&select=*&order=created_at.desc`
    );
    return res.status(200).json(rows || []);
  }

  // POST: create alert
  if (req.method === 'POST') {
    const { symbol, target_price, direction } = req.body || {};
    if (!symbol || !target_price || !direction) {
      return res.status(400).json({ error: 'symbol, target_price, and direction required' });
    }
    if (!['above', 'below'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be "above" or "below"' });
    }

    const rows = await supabaseRequest('alerts', {
      method: 'POST',
      body: {
        user_email: email,
        symbol: symbol.toUpperCase().trim(),
        target_price: Number(target_price),
        direction,
      },
    });
    return res.status(201).json(Array.isArray(rows) ? rows[0] : rows);
  }

  // DELETE: remove alert by id
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Alert id required' });

    await supabaseRequest(
      `alerts?id=eq.${encodeURIComponent(id)}&user_email=eq.${encodeURIComponent(email)}`,
      { method: 'DELETE' }
    );
    return res.status(200).json({ ok: true });
  }

  return errorResponse(res, 405, 'Method not allowed');
}
