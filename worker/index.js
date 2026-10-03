// Workers entry for epiphany. Serves the Vite build from the assets binding and
// routes /api/* into the existing Vercel-style gateway handler.
//
// ponytail: api/gateway.js is already a single (req, res) dispatcher over
// server/api/**, so the whole migration is one adapter rather than 72 rewrites.
import gateway from '../api/gateway.js';

// Vercel handlers expect Node's (req, res). Build a request shim, collect what
// the handler writes, and hand back a Response.
function makeReq(request, url, body, rawBody) {
  const headers = Object.fromEntries(request.headers);
  return {
    method: request.method,
    url: url.pathname + url.search,
    headers,
    query: Object.fromEntries(url.searchParams),
    body,
    // Stripe signs the exact bytes it sent, so the webhook handler cannot use the
    // parsed `body`. This object is not a Node stream either, so re-reading is
    // impossible: the raw text has to be carried alongside the parsed value.
    rawBody,
    // Handlers fall back to this for rate limiting when x-forwarded-for is absent.
    socket: { remoteAddress: headers['cf-connecting-ip'] || '' },
  };
}

function makeRes() {
  const headers = new Headers();
  const state = { status: 200, body: null, headersSent: false, done: null };
  const res = {
    get headersSent() { return state.headersSent; },
    setHeader(k, v) {
      // Arrays (a second Set-Cookie) must append, not comma-join.
      if (Array.isArray(v)) { headers.delete(k); v.forEach(x => headers.append(k, String(x))); } else headers.set(k, String(v));
      return res;
    },
    status(code) { state.status = code; return res; },
    json(payload) {
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      state.body = JSON.stringify(payload);
      state.headersSent = true;
      state.done?.();
      return res;
    },
    writeHead(code, hdrs) {
      state.status = code;
      for (const [k, v] of Object.entries(hdrs || {})) headers.set(k, String(v));
      state.headersSent = true;
      return res;
    },
    end(chunk) {
      if (chunk != null) state.body = chunk;
      state.headersSent = true;
      state.done?.();
      return res;
    },
  };
  return { res, state, headers };
}

async function readBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const type = request.headers.get('content-type') || '';
  try {
    if (type.includes('form')) return { body: Object.fromEntries(await request.formData()) };
    // Read the text once and parse from it, so the raw bytes survive for signature checks.
    const rawBody = await request.text();
    if (type.includes('application/json')) {
      return { body: rawBody ? JSON.parse(rawBody) : undefined, rawBody };
    }
    return { body: rawBody, rawBody };
  } catch {
    return undefined;
  }
}

// _blob.js reads its binding and public origin off globalThis so the call sites
// it replaced keep their original signatures.
function bindGlobals(env, origin, ctx) {
  globalThis.__blobKv = env.BLOB;
  // Lets handlers finish work after responding (news.js stale-while-revalidate).
  globalThis.__waitUntil = ctx ? (p) => ctx.waitUntil(p) : null;
  globalThis.__publicBaseUrl = env.PUBLIC_BASE_URL || origin;
}

const TYPES = { pdf: 'application/pdf', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
function guessType(key) {
  return TYPES[key.split('.').pop()?.toLowerCase()] || 'application/octet-stream';
}

async function handleApi(request, url) {
  const { body, rawBody } = (await readBody(request)) || {};
  const { res, state, headers } = makeRes();
  await gateway(makeReq(request, url, body, rawBody), res);
  return new Response(state.body, { status: state.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    // nodejs_compat populates process.env from bindings only on recent
    // compatibility dates; assign defensively so handlers reading it still work.
    try { Object.assign(process.env, env); } catch { /* read-only, compat date handles it */ }
    bindGlobals(env, new URL(request.url).origin, ctx);

    const url = new URL(request.url);

    // Serve objects written through server/api/_blob.js. Handlers persist these
    // URLs, so this route is what makes a stored blob.url resolvable.
    if (url.pathname.startsWith('/api/blob/')) {
      const key = decodeURIComponent(url.pathname.slice('/api/blob/'.length));
      // Bank statements were access:private on Vercel Blob; nothing client-side
      // reads them by URL, so they are never served here.
      if (key.startsWith('statements/')) return new Response('Not found', { status: 404 });
      const body = await env.BLOB.get('blob:' + key, 'arrayBuffer');
      if (!body) return new Response('Not found', { status: 404 });
      return new Response(body, {
        headers: {
          'Content-Type': guessType(key),
          // Keys are overwritten in place (cron snapshot), so keep browsers short.
          'Cache-Control': 'public, max-age=60',
        },
      });
    }
    if (url.pathname.startsWith('/api/')) {
      // Vercel 413ed at 4.5MB; Workers accept 100MB, so cap bodies here.
      if (Number(request.headers.get('content-length') || 0) > 8 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { 'Content-Type': 'application/json' } });
      }
      try {
        // The gateway's s-maxage header meant something on Vercel's CDN; here the
        // Cache API is the edge cache, so public GETs are stored for that TTL.
        const origin = request.headers.get('Origin');
        const cacheable = request.method === 'GET' && (!origin || origin === url.origin);
        const cacheKey = cacheable ? new Request(url.toString(), { method: 'GET' }) : null;
        if (cacheKey) {
          const hit = await caches.default.match(cacheKey);
          if (hit) {
            const out = new Response(hit.body, hit);
            // Edge keeps it; browsers must not (the zone would stamp a 4h max-age on hits).
            out.headers.set('Cache-Control', 'no-cache');
            out.headers.set('X-Epiphany-Cache', 'hit');
            return out;
          }
        }
        const resp = await handleApi(request, url);
        const ttl = Number((resp.headers.get('Cache-Control') || '').match(/s-maxage=(\d+)/)?.[1] || 0);
        if (cacheKey && resp.status === 200 && ttl > 0 && !resp.headers.has('Set-Cookie')) {
          const copy = new Response(resp.clone().body, resp);
          copy.headers.set('Cache-Control', `public, s-maxage=${ttl}`);
          ctx.waitUntil(caches.default.put(cacheKey, copy));
        }
        resp.headers.set('X-Epiphany-Cache', 'miss');
        return resp;
      } catch (err) {
        console.error('[worker] api error:', err?.message, err?.stack?.split('\n')[1]);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
      }
    }
    return env.ASSETS.fetch(request);
  },

  // Replaces the three Vercel cron entries in vercel.json. Cron Triggers are a
  // Workers feature; Pages Functions cannot run them, which is why this project
  // targets Workers rather than Pages.
  async scheduled(event, env, ctx) {
    try { Object.assign(process.env, env); } catch { /* see above */ }
    bindGlobals(env, env.PUBLIC_BASE_URL || 'https://epiphany.heyitsmejosh.com', ctx);

    // The daily 12:00 tick also runs crypto paper trading: crypto trades on weekends, the stock crons do not.
    const paths = { '0 8 * * 1-5': ['cron'], '30 14 * * 1-5': ['broker/morning-run'], '0 12 * * *': ['supabase-ping', 'broker/crypto-paper'] }[event.cron] || [];
    for (const path of paths) {
      const url = new URL(`https://cron.local/api/${path}`);
      const req = makeReq(new Request(url, { headers: { Authorization: `Bearer ${env.CRON_SECRET || ''}` } }), url, undefined, undefined);
      const { res, state } = makeRes();
      await gateway(req, res);
      console.log(`[cron] ${event.cron} -> ${path} -> ${state.status}`);
    }
  },
};
