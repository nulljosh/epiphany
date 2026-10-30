// A stock's last four quarters of earnings (EPS actual against the estimate) and the analysts' price target,
// from Yahoo's quoteSummary earningsHistory and financialData modules (same cookie and crumb session as the fundamentals).
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

/** Analysts' mean target, range, count and consensus ("buy", "hold"...), or null when there's no coverage. */
export function parseAnalysts(json) {
  const f = json?.quoteSummary?.result?.[0]?.financialData;
  const mean = f?.targetMeanPrice?.raw;
  if (typeof mean !== 'number' || !(f?.numberOfAnalystOpinions?.raw > 0)) return null;
  return {
    mean, high: f.targetHighPrice?.raw ?? null, low: f.targetLowPrice?.raw ?? null,
    count: f.numberOfAnalystOpinions.raw,
    consensus: typeof f.recommendationKey === 'string' && f.recommendationKey !== 'none' ? f.recommendationKey.replace(/_/g, ' ') : null,
  };
}

export default async function handler(req, res) {
  const symbol = String(req.query?.symbol || '').toUpperCase().trim();
  if (!/^[A-Z0-9.\-^=]{1,15}$/.test(symbol)) return errorResponse(res, 400, 'symbol required');
  for (const base of BASES) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const session = await getYahooCrumb({ force: attempt > 0 });
      const crumb = session.crumb ? `&crumb=${encodeURIComponent(session.crumb)}` : '';
      try {
        const r = await fetch(`${base}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=earningsHistory,financialData${crumb}`,
          { headers: session.cookie ? { ...YAHOO_HEADERS, Cookie: session.cookie } : YAHOO_HEADERS, signal: AbortSignal.timeout(8000) });
        if (r.status === 401 && attempt === 0) continue;
        if (!r.ok) break;
        res.setHeader('Cache-Control', 'public, max-age=3600');
        const json = await r.json();
        return res.status(200).json({ symbol, quarters: parseEarningsHistory(json), analysts: parseAnalysts(json) });
      } catch {
        break;
      }
    }
  }
  return errorResponse(res, 502, 'Earnings history unavailable');
}
