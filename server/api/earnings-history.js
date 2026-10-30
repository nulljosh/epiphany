// A stock's last four quarters of earnings: EPS actual against the estimate, from Yahoo's quoteSummary
// earningsHistory module (same cookie and crumb session as the fundamentals).
import { getYahooCrumb, YAHOO_HEADERS } from './stocks-shared.js';
import { errorResponse } from './auth-helpers.js';

const BASES = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

/** Quarters oldest first: { quarter: "Q2 2026", actual, estimate, surprise } with surprise in percent. */
export function parseEarningsHistory(json) {
  const rows = json?.quoteSummary?.result?.[0]?.earningsHistory?.history || [];
  return rows
    .filter((r) => typeof r?.epsActual?.raw === 'number' && typeof r?.epsEstimate?.raw === 'number')
    .map((r) => {
      const d = new Date((r.quarter?.raw || 0) * 1000);
      return {
        quarter: `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`,
        actual: r.epsActual.raw,
        estimate: r.epsEstimate.raw,
        surprise: typeof r.surprisePercent?.raw === 'number' ? r.surprisePercent.raw * 100 : null,
      };
    })
    .slice(-4);
}

export default async function handler(req, res) {
  const symbol = String(req.query?.symbol || '').toUpperCase().trim();
  if (!/^[A-Z0-9.\-^=]{1,15}$/.test(symbol)) return errorResponse(res, 400, 'symbol required');
  for (const base of BASES) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const session = await getYahooCrumb({ force: attempt > 0 });
      const crumb = session.crumb ? `&crumb=${encodeURIComponent(session.crumb)}` : '';
      try {
        const r = await fetch(`${base}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=earningsHistory${crumb}`,
          { headers: session.cookie ? { ...YAHOO_HEADERS, Cookie: session.cookie } : YAHOO_HEADERS, signal: AbortSignal.timeout(8000) });
        if (r.status === 401 && attempt === 0) continue;
        if (!r.ok) break;
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.status(200).json({ symbol, quarters: parseEarningsHistory(await r.json()) });
      } catch {
        break;
      }
    }
  }
  return errorResponse(res, 502, 'Earnings history unavailable');
}
