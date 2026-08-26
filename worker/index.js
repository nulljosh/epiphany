// Workers entry for epiphany. Serves the Vite build from the assets binding and
// routes /api/* into the existing Vercel-style gateway handler.
//
// ponytail: api/gateway.js is already a single (req, res) dispatcher over
// server/api/**, so the whole migration is one adapter rather than 72 rewrites.
import gateway from '../api/gateway.js';

// Vercel handlers expect Node's (req, res). Build a request shim, collect what
// the handler writes, and hand back a Response.
function makeReq(request, url, body) {
  const headers = Object.fromEntries(request.headers);
  return {
    method: request.method,
    url: url.pathname + url.search,
    headers,
    query: Object.fromEntries(url.searchParams),
    body,
    // Handlers fall back to this for rate limiting when x-forwarded-for is absent.
    socket: { remoteAddress: headers['cf-connecting-ip'] || '' },
  };
}

function makeRes() {
  const headers = new Headers();
  const state = { status: 200, body: null, headersSent: false, done: null };
  const res = {
    get headersSent() { return state.headersSent; },
    setHeader(k, v) { headers.set(k, String(v)); return res; },
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
    if (type.includes('application/json')) return await request.json();
    if (type.includes('form')) return Object.fromEntries(await request.formData());
    return await request.text();
  } catch {
    return undefined;
  }
}

// _blob.js reads its binding and public origin off globalThis so the call sites
// it replaced keep their original signatures.
function bindGlobals(env, origin) {
  globalThis.__blobKv = env.BLOB;
  globalThis.__publicBaseUrl = env.PUBLIC_BASE_URL || origin;
}

const TYPES = { pdf: 'application/pdf', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
function guessType(key) {
  return TYPES[key.split('.').pop()?.toLowerCase()] || 'application/octet-stream';
}

async function handleApi(request, url) {
  const body = await readBody(request);
  const { res, state, headers } = makeRes();
  await gateway(makeReq(request, url, body), res);
  return new Response(state.body, { status: state.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    // nodejs_compat populates process.env from bindings only on recent
    // compatibility dates; assign defensively so handlers reading it still work.
    try { Object.assign(process.env, env); } catch { /* read-only, compat date handles it */ }
    bindGlobals(env, new URL(request.url).origin);

    const url = new URL(request.url);

    // Serve objects written through server/api/_blob.js. Handlers persist these
    // URLs, so this route is what makes a stored blob.url resolvable.
    if (url.pathname.startsWith('/api/blob/')) {
      const key = decodeURIComponent(url.pathname.slice('/api/blob/'.length));
      const body = await env.BLOB.get('blob:' + key, 'arrayBuffer');
      if (!body) return new Response('Not found', { status: 404 });
      return new Response(body, {
        headers: {
          'Content-Type': guessType(key),
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, url);
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
    bindGlobals(env, env.PUBLIC_BASE_URL || 'https://epiphany.heyitsmejosh.com');

    const path = { '0 8 * * 1-5': 'cron', '30 14 * * 1-5': 'broker/morning-run', '0 12 * * *': 'supabase-ping' }[event.cron];
    if (!path) return;

    const url = new URL(`https://cron.local/api/${path}`);
    const req = makeReq(new Request(url, { headers: { Authorization: `Bearer ${env.CRON_SECRET || ''}` } }), url, undefined);
    const { res, state } = makeRes();
    await gateway(req, res);
    console.log(`[cron] ${event.cron} -> ${path} -> ${state.status}`);
  },
};
