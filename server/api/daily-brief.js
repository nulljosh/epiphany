import { applyCors } from './_cors.js';
import { getYahooCrumb, YAHOO_HEADERS, DEFAULT_SYMBOLS, isMarketHours } from './stocks-shared.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';
import { isPro } from './gates.js';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let cache = { ts: 0, data: null };

const YAHOO_BASES = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

// Movers come from the working Yahoo v7 batch quote (cookie+crumb authed) -- NOT
// FMP, which has never had a key in prod (so movers were always empty -> the
// "no data available" brief). Keyless, free, same path the stocks pipeline uses.
async function fetchTopMovers() {
  const session = await getYahooCrumb();
  const crumbParam = session?.crumb ? `&crumb=${encodeURIComponent(session.crumb)}` : '';
  const headers = { ...YAHOO_HEADERS };
  if (session?.cookie) headers.Cookie = session.cookie;
  const fields = 'symbol,shortName,regularMarketPrice,regularMarketChangePercent';

  for (const base of YAHOO_BASES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const url = `${base}/v7/finance/quote?symbols=${encodeURIComponent(DEFAULT_SYMBOLS)}&fields=${fields}${crumbParam}`;
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const quotes = data.quoteResponse?.result;
      if (!Array.isArray(quotes) || quotes.length === 0) continue;
      const rows = quotes
        .filter(q => Number.isFinite(q.regularMarketChangePercent))
        .map(q => ({
          symbol: q.symbol,
          name: q.shortName || q.symbol,
          price: q.regularMarketPrice,
          change: q.regularMarketChangePercent,
        }));
      const sorted = [...rows].sort((a, b) => b.change - a.change);
      return {
        gainers: sorted.filter(r => r.change > 0).slice(0, 5),
        losers: sorted.filter(r => r.change < 0).slice(-5).reverse(),
      };
    } catch {
      clearTimeout(timer);
    }
  }
  return { gainers: [], losers: [] };
}

const ENGLISH_STOPS = new Set(['the', 'is', 'are', 'was', 'has', 'for', 'and', 'but', 'not', 'this', 'that', 'with', 'from', 'will', 'said', 'new', 'after']);

async function fetchHeadlines() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=business%20market&mode=artlist&maxrecords=5&format=json&sort=datedesc&sourcelang=english`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.articles || [])
      .filter(a => {
        if (!a.title || a.title.length < 10) return false;
        const words = a.title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        return words.filter(w => ENGLISH_STOPS.has(w)).length >= 2;
      })
      .slice(0, 3)
      .map(a => a.title.trim());
  } catch {
    clearTimeout(timer);
    return [];
  }
}

function buildBrief(movers, headlines) {
  let marketSummary = '';
  if (movers.gainers.length > 0 || movers.losers.length > 0) {
    const gainStr = movers.gainers.slice(0, 2).map(g => `${g.symbol} +${g.change?.toFixed(1)}%`).join(', ');
    const lossStr = movers.losers.slice(0, 2).map(l => `${l.symbol} ${l.change?.toFixed(1)}%`).join(', ');
    const parts = [];
    if (gainStr) parts.push(`Gainers: ${gainStr}`);
    if (lossStr) parts.push(`Decliners: ${lossStr}`);
    marketSummary = parts.join('. ');
  }

  let newsSummary = '';
  if (headlines.length > 0) {
    newsSummary = headlines.slice(0, 3).join(' • ');
  }

  const summary = [marketSummary, newsSummary].filter(Boolean).join('\n\n') ||
    (isMarketHours() ? 'US markets are open. Quotes updating live.' : 'US markets are closed. Showing last session.');

  return {
    summary,
    marketSummary,
    newsSummary,
    points: [summary], // Legacy: single compiled point
  };
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getSessionUser(req);
  if (!(await isPro(session))) return errorResponse(res, 402, 'Premium required');

  const now = Date.now();
  if (cache.data && (now - cache.ts) < CACHE_TTL) {
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json(cache.data);
  }

  try {
    const [movers, headlines] = await Promise.all([
      fetchTopMovers(),
      fetchHeadlines(),
    ]);

    const { points, summary } = buildBrief(movers, headlines);

    const brief = {
      summary,
      points,
      gainers: movers.gainers,
      losers: movers.losers,
      generatedAt: new Date().toISOString(),
    };

    cache = { ts: now, data: brief };
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json(brief);
  } catch (err) {
    console.error('Daily brief error:', err.message);
    if (cache.data) return res.status(200).json(cache.data);
    return res.status(502).json({ error: 'Failed to generate daily brief' });
  }
}
