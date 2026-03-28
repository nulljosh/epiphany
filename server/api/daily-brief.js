import { applyCors } from './_cors.js';
import { getFmpApiKey, FMP_BASE } from './stocks-shared.js';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let cache = { ts: 0, data: null };

async function fetchTopMovers(apiKey) {
  if (!apiKey) return { gainers: [], losers: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const [gainRes, loseRes] = await Promise.all([
      fetch(`${FMP_BASE}/stock_market/gainers?apikey=${apiKey}`, { signal: controller.signal }),
      fetch(`${FMP_BASE}/stock_market/losers?apikey=${apiKey}`, { signal: controller.signal }),
    ]);
    clearTimeout(timer);
    const gainers = gainRes.ok ? (await gainRes.json()).slice(0, 5).map(s => ({
      symbol: s.symbol, name: s.name, price: s.price, change: s.changesPercentage,
    })) : [];
    const losers = loseRes.ok ? (await loseRes.json()).slice(0, 5).map(s => ({
      symbol: s.symbol, name: s.name, price: s.price, change: s.changesPercentage,
    })) : [];
    return { gainers, losers };
  } catch {
    clearTimeout(timer);
    return { gainers: [], losers: [] };
  }
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
  const points = [];

  if (movers.gainers.length > 0) {
    const top = movers.gainers[0];
    points.push(`${top.symbol} leads gainers at +${top.change?.toFixed(1)}%`);
  }
  if (movers.losers.length > 0) {
    const top = movers.losers[0];
    points.push(`${top.symbol} leads decliners at ${top.change?.toFixed(1)}%`);
  }
  for (const h of headlines) {
    points.push(h);
  }

  return points.slice(0, 5);
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const now = Date.now();
  if (cache.data && (now - cache.ts) < CACHE_TTL) {
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json(cache.data);
  }

  try {
    const apiKey = getFmpApiKey();
    const [movers, headlines] = await Promise.all([
      fetchTopMovers(apiKey),
      fetchHeadlines(),
    ]);

    const brief = {
      points: buildBrief(movers, headlines),
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
