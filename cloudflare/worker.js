import { createNodeResponse, installProcessEnv, toNodeRequest } from './runtime-adapter.js';

export const LOCAL_ROUTE_LOADERS = {
  commodities: () => import('../server/api/commodities.js'),
  crime: () => import('../server/api/crime.js'),
  earthquakes: () => import('../server/api/earthquakes.js'),
  events: () => import('../server/api/events.js'),
  flights: () => import('../server/api/flights.js'),
  history: () => import('../server/api/history.js'),
  incidents: () => import('../server/api/incidents.js'),
  'local-events': () => import('../server/api/local-events.js'),
  macro: () => import('../server/api/macro.js'),
  markets: () => import('../server/api/markets.js'),
  news: () => import('../server/api/news.js'),
  prices: () => import('../server/api/prices.js'),
  stocks: () => import('../server/api/stocks.js'),
  'stocks-free': () => import('../server/api/stocks-free.js'),
  traffic: () => import('../server/api/traffic.js'),
  'validate-link': () => import('../server/api/validate-link.js'),
  weather: () => import('../server/api/weather.js'),
  'weather-alerts': () => import('../server/api/weather-alerts.js'),
};

function getRoutePath(url) {
  return url.pathname.replace(/^\/api\/?/, '').replace(/^\/+|\/+$/g, '');
}

async function proxyToVercel(request, env) {
  const fallbackOrigin = env.VERCEL_FALLBACK_ORIGIN || 'https://monica.heyitsmejosh.com';
  const incomingUrl = new URL(request.url);
  const proxyUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, fallbackOrigin);

  const headers = new Headers(request.headers);
  headers.delete('host');

  return fetch(proxyUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    redirect: 'follow',
  });
}

export default {
  async fetch(request, env) {
    installProcessEnv(env);

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Cloudflare API worker only handles /api/* routes' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const routePath = getRoutePath(url);
    const loader = LOCAL_ROUTE_LOADERS[routePath];

    if (!loader) {
      return proxyToVercel(request, env);
    }

    const mod = await loader();
    const handler = mod.default;
    const req = await toNodeRequest(request);
    const res = createNodeResponse();

    await handler(req, res);
    return res.toResponse();
  },
};
