import { supabaseRequest, supabaseConfigured } from './supabase.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';

// Symbol validation: 1-5 uppercase letters/digits, dots allowed
const SYMBOL_REGEX = /^[A-Z0-9.]{1,5}$/;

function isValidSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') return false;
  return SYMBOL_REGEX.test(symbol.toUpperCase());
}

export default async function handler(req, res) {
  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');
  if (!supabaseConfigured()) return errorResponse(res, 503, 'Database not configured');

  const email = session.email;

  // GET: list watchlist
  if (req.method === 'GET') {
    const rows = await supabaseRequest(`watchlists?user_email=eq.${encodeURIComponent(email)}&select=id,user_email,symbol,added_at&order=added_at.asc`);
    return res.status(200).json(rows || []);
  }

  // POST: add symbol
  if (req.method === 'POST') {
    let { symbol } = req.body || {};
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });
    symbol = symbol.toUpperCase().trim();
    if (!isValidSymbol(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol format (1-5 characters, A-Z, 0-9, . only)' });
    }

    try {
      const rows = await supabaseRequest('watchlists', {
        method: 'POST',
        body: { user_email: email, symbol },
      });
      return res.status(201).json(Array.isArray(rows) ? rows[0] : rows);
    } catch (err) {
      if (err.status === 409 || (err.message && err.message.includes('duplicate'))) {
        return res.status(409).json({ error: 'Symbol already in watchlist' });
      }
      throw err;
    }
  }

  // DELETE: remove symbol
  if (req.method === 'DELETE') {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });
    if (!isValidSymbol(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol format' });
    }

    await supabaseRequest(
      `watchlists?user_email=eq.${encodeURIComponent(email)}&symbol=eq.${encodeURIComponent(symbol.toUpperCase())}`,
      { method: 'DELETE' }
    );
    return res.status(200).json({ ok: true });
  }

  return errorResponse(res, 405, 'Method not allowed');
}
