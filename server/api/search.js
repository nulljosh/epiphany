import { applyCors } from './_cors.js';
import { YAHOO_HEADERS } from './stocks-shared.js';

// Ticker and company search for the watchlist: GET /api/search?q=shopify.
// Yahoo's keyless search, the same unofficial endpoint family stocks-free.js uses.
const TYPES = new Set(['EQUITY', 'ETF', 'INDEX', 'CRYPTOCURRENCY', 'MUTUALFUND', 'FUTURE', 'CURRENCY']);

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = String(req.query?.q || '').trim().slice(0, 40);
  if (!q) return res.status(200).json({ results: [] });

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
    const response = await fetch(url, { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(6000) });
    if (!response.ok) return res.status(502).json({ error: `Search returned HTTP ${response.status}` });
    const data = await response.json();
    const results = (data.quotes || [])
      .filter(r => r.symbol && TYPES.has(r.quoteType))
      .map(r => ({
        symbol: r.symbol,
        name: r.shortname || r.longname || r.symbol,
        exchange: r.exchDisp || r.exchange || null,
        type: r.quoteType,
      }));
    return res.status(200).json({ results });
  } catch (err) {
    return res.status(502).json({ error: 'Search unavailable', details: err.message });
  }
}
