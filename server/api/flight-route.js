// Where a flight is going, from its callsign, via adsbdb.com (free, no key).
// ponytail: adsbdb's route table is crowd-sourced and can be stale for a callsign; we show it as "scheduled route".
const CALLSIGN = /^[A-Z0-9]{2,8}$/;

const airport = (a) => (a && Number.isFinite(a.latitude) && Number.isFinite(a.longitude)
  ? { code: a.iata_code || a.icao_code, city: a.municipality || a.name, lat: a.latitude, lon: a.longitude }
  : null);

/** { airline, origin, destination } from an adsbdb callsign response, or null. */
export function parseRoute(json) {
  const r = json?.response?.flightroute;
  const origin = airport(r?.origin);
  const destination = airport(r?.destination);
  if (!origin || !destination) return null;
  return { airline: r.airline?.name ?? null, origin, destination };
}

export default async function handler(req, res) {
  const callsign = String(req.query?.callsign ?? '').trim().toUpperCase();
  if (!CALLSIGN.test(callsign)) return res.status(400).json({ error: 'callsign required' });
  try {
    const r = await fetch(`https://api.adsbdb.com/v0/callsign/${callsign}`, { headers: { 'User-Agent': 'Mozilla/5.0 (epiphany.jaybulb.com)' }, signal: AbortSignal.timeout(5000) });
    res.setHeader('X-Route-Status', String(r.status));
    // adsbdb answers 404 for an unknown callsign; that is "no route", not an error.
    const route = r.ok ? parseRoute(await r.json()) : null;
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({ route });
  } catch {
    return res.status(502).json({ error: 'route lookup unavailable' });
  }
}
