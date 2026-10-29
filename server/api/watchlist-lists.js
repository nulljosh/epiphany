import { getKv } from './_kv.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';

// Named watchlists beyond the main one (which stays in the watchlists table).
// One KV record per user: { lists: [{ name, symbols }] }.
const SYMBOL_REGEX = /^[A-Z0-9.\-=^]{1,12}$/;
const MAX_LISTS = 10;
const MAX_SYMBOLS = 50;

// Trims, dedupes and caps what a client sends; returns null when it isn't a list of lists.
export function cleanLists(input) {
  if (!Array.isArray(input)) return null;
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 24) : '';
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const symbols = [...new Set((Array.isArray(raw.symbols) ? raw.symbols : [])
      .map((s) => String(s).toUpperCase().trim())
      .filter((s) => SYMBOL_REGEX.test(s)))].slice(0, MAX_SYMBOLS);
    out.push({ name, symbols });
    if (out.length === MAX_LISTS) break;
  }
  return out;
}

export default async function handler(req, res) {
  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');
  const kv = await getKv();
  const key = `watchlist-lists:${session.email}`;

  if (req.method === 'GET') {
    const stored = await kv.get(key);
    return res.status(200).json({ lists: cleanLists(stored?.lists) || [] });
  }

  if (req.method === 'PUT') {
    const lists = cleanLists(req.body?.lists);
    if (!lists) return errorResponse(res, 400, 'lists must be an array of { name, symbols }');
    await kv.set(key, { lists });
    return res.status(200).json({ lists });
  }

  return errorResponse(res, 405, 'Method not allowed');
}
