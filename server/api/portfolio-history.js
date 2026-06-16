import { supabaseRequest, supabaseConfigured } from './supabase.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';

export default async function handler(req, res) {
  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');
  if (!supabaseConfigured()) return errorResponse(res, 503, 'Database not configured');

  const email = session.email;

  // GET: fetch history
  if (req.method === 'GET') {
    const limit = req.query.limit || 90;
    const rows = await supabaseRequest(
      `portfolio_history?user_email=eq.${encodeURIComponent(email)}&select=*&order=snapshot_date.desc&limit=${limit}`
    );
    return res.status(200).json(rows || []);
  }

  // POST: save snapshot (upsert by user_email + snapshot_date)
  if (req.method === 'POST') {
    const { total_value, day_change, holdings } = req.body || {};
    if (total_value === undefined) {
      return res.status(400).json({ error: 'total_value required' });
    }

    const today = new Date().toISOString().slice(0, 10);

    try {
      // Try upsert via POST with on_conflict
      const rows = await supabaseRequest('portfolio_history?on_conflict=user_email,snapshot_date', {
        method: 'POST',
        body: {
          user_email: email,
          total_value: Number(total_value),
          day_change: day_change != null ? Number(day_change) : null,
          snapshot_date: today,
          holdings: holdings || null,
        },
      });
      return res.status(201).json(Array.isArray(rows) ? rows[0] : rows);
    } catch (err) {
      // If conflict, update instead
      if (err.status === 409 || (err.message && err.message.includes('duplicate'))) {
        const rows = await supabaseRequest(
          `portfolio_history?user_email=eq.${encodeURIComponent(email)}&snapshot_date=eq.${today}`,
          {
            method: 'PATCH',
            body: {
              total_value: Number(total_value),
              day_change: day_change != null ? Number(day_change) : null,
              holdings: holdings || null,
            },
          }
        );
        return res.status(200).json(Array.isArray(rows) ? rows[0] : rows);
      }
      throw err;
    }
  }

  return errorResponse(res, 405, 'Method not allowed');
}
