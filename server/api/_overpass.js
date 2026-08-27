// Shared Overpass client with mirror failover.
//
// overpass-api.de refuses connections from Cloudflare Workers egress (the
// subrequest surfaces as HTTP 521), which silently emptied the incidents and
// local-events map layers after the API moved to Workers. It is also plainly
// flaky — it returns 504 under load from anywhere. Both problems have the same
// answer: ask the mirrors in turn and take the first that answers.
// ponytail: plain ordered failover, no health tracking — add that only if the
// first mirror starts costing a visible delay on most requests.

const MIRRORS = (process.env.OVERPASS_MIRRORS ||
  [
    // Global-coverage instances only. overpass.osm.ch is deliberately absent:
    // it is a Switzerland-only extract that answers 200 with zero elements for
    // anywhere else, so failover can never tell it apart from "nothing here".
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ].join(','))
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

/**
 * Run an Overpass QL query, trying each mirror until one answers.
 * @param {string} query      Overpass QL
 * @param {number} timeoutMs  per-mirror timeout
 * @returns {Promise<object>} parsed Overpass JSON
 * @throws if every mirror fails
 */
export async function overpassQuery(query, timeoutMs = 12000) {
  const body = `data=${encodeURIComponent(query)}`;
  const failures = [];

  for (const url of MIRRORS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      if (!res.ok) {
        // Read the body before moving on; an abandoned response body stalls the
        // Workers runtime and takes later fetches down with it.
        await res.arrayBuffer().catch(() => {});
        throw new Error(`HTTP ${res.status}`);
      }
      if (failures.length) console.warn(`[overpass] served by ${new URL(url).host} after ${failures.join('; ')}`);
      return await res.json();
    } catch (err) {
      failures.push(`${new URL(url).host}: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Overpass unavailable (${failures.join('; ')})`);
}
