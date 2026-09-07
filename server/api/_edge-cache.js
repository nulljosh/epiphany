// Cloudflare Cache API wrapper: shared across isolates + colos, unlike a module-level Map,
// which dies with the isolate and so misses on nearly every request under Workers.
// ponytail: best-effort; falls through to upstream on any cache error. Move to KV if a
// colo-wide cache proves short.
function edgeKey(ns, key) { return `https://${ns}.epiphany.internal/${encodeURIComponent(key)}`; }

export async function edgeGet(ns, key) {
  try {
    if (typeof caches === 'undefined') return null;
    const r = await caches.default.match(edgeKey(ns, key));
    if (!r) return null;
    return { data: await r.json(), ts: Number(r.headers.get('X-Ts')) || 0 };
  } catch { return null; }
}

export async function edgePut(ns, key, data, ttlS) {
  try {
    if (typeof caches === 'undefined') return;
    await caches.default.put(edgeKey(ns, key), new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'X-Ts': String(Date.now()), 'Cache-Control': `s-maxage=${ttlS}` },
    }));
  } catch { /* best-effort */ }
}
