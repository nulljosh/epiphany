// S&P 500 current constituent list
// Source: GitHub datasets/s-and-p-500-companies (maintained, updated on additions/removals)
// Cached in memory for 1 week -- S&P 500 changes infrequently

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CSV_URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv';

let cached = null;

async function fetchConstituents() {
  const res = await fetch(CSV_URL, { headers: { 'User-Agent': 'Epiphany/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n').slice(1); // skip header
  return lines
    .map(line => {
      const parts = line.split(',');
      const symbol = (parts[0] || '').replace(/"/g, '').trim();
      const name = (parts[1] || '').replace(/"/g, '').trim();
      const sector = (parts[2] || '').replace(/"/g, '').trim();
      return symbol ? { symbol, name, sector } : null;
    })
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ constituents: cached.data, cached: true });
  }

  try {
    const data = await fetchConstituents();
    cached = { data, ts: Date.now() };
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ constituents: data });
  } catch (err) {
    console.error('S&P 500 fetch error:', err.message);
    if (cached) {
      return res.status(200).json({ constituents: cached.data, stale: true });
    }
    return res.status(503).json({ error: 'S&P 500 data temporarily unavailable' });
  }
}
