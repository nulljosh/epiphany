// Epiphany API Gateway - single serverless function routing
// Critical routes are static imports (fail fast at build).
// Non-critical routes use lazy() so one broken file can't kill everything.

import '../server/api/_startup-check.js';
import auth from '../server/api/auth.js';
import { errorResponse } from '../server/api/auth-helpers.js';
import stocksFree from '../server/api/stocks-free.js';
import markets from '../server/api/markets.js';
import latest from '../server/api/latest.js';

function lazy(loader) {
  let mod;
  return async (req, res) => {
    if (!mod) {
      try { mod = (await loader()).default; }
      catch (err) {
        console.error(`[GATEWAY] Lazy load failed: ${err.message}`);
        return res.status(503).json({ error: 'Route temporarily unavailable' });
      }
    }
    return mod(req, res);
  };
}

const ROUTES = {
  // Critical -- static imports, fail at build if missing
  auth,
  'stocks-free': stocksFree,
  markets,
  latest,

  // Everything else -- lazy loaded, isolated failures
  aqi:                  lazy(() => import('../server/api/aqi.js')),
  ai:                   lazy(() => import('../server/api/ai.js')),
  'daily-brief':        lazy(() => import('../server/api/daily-brief.js')),
  commodities:          lazy(() => import('../server/api/commodities.js')),
  'fear-greed':         lazy(() => import('../server/api/fear-greed.js')),
  crime:                lazy(() => import('../server/api/crime.js')),
  cron:                 lazy(() => import('../server/api/cron.js')),
  defuddle:             lazy(() => import('../server/api/defuddle.js')),
  earthquakes:          lazy(() => import('../server/api/earthquakes.js')),
  events:               lazy(() => import('../server/api/events.js')),
  flights:              lazy(() => import('../server/api/flights.js')),
  history:              lazy(() => import('../server/api/history.js')),
  incidents:            lazy(() => import('../server/api/incidents.js')),
  'local-events':       lazy(() => import('../server/api/local-events.js')),
  macro:                lazy(() => import('../server/api/macro.js')),
  news:                 lazy(() => import('../server/api/news.js')),
  prices:               lazy(() => import('../server/api/prices.js')),
  signals:              lazy(() => import('../server/api/signals.js')),
  statements:           lazy(() => import('../server/api/statements.js')),
  stocks:               lazy(() => import('../server/api/stocks.js')),
  stripe:               lazy(() => import('../server/api/stripe.js')),
  'stripe-webhook':     lazy(() => import('../server/api/stripe-webhook.js')),
  traffic:              lazy(() => import('../server/api/traffic.js')),
  'validate-link':      lazy(() => import('../server/api/validate-link.js')),
  'weather-alerts':     lazy(() => import('../server/api/weather-alerts.js')),
  weather:              lazy(() => import('../server/api/weather.js')),
  webhook:              lazy(() => import('../server/api/webhook.js')),
  wildfires:            lazy(() => import('../server/api/wildfires.js')),
  dispatch:             lazy(() => import('../server/api/dispatch.js')),
  people:               lazy(() => import('../server/api/people.js')),
  'people-index':       lazy(() => import('../server/api/people-index.js')),
  'people-enrich':      lazy(() => import('../server/api/people-enrich.js')),
  'people-crossref':    lazy(() => import('../server/api/people-crossref.js')),
  'people-import':      lazy(() => import('../server/api/people-import.js')),
  'people-auto-enrich': lazy(() => import('../server/api/people-auto-enrich.js')),
  portfolio:            lazy(() => import('../server/api/portfolio.js')),
  watchlist:            lazy(() => import('../server/api/watchlist.js')),
  alerts:               lazy(() => import('../server/api/alerts.js')),
  avatar:               lazy(() => import('../server/api/avatar.js')),
  ontology:             lazy(() => import('../server/api/ontology.js')),
  'portfolio/history':  lazy(() => import('../server/api/portfolio-history.js')),
  'broker/signal':           lazy(() => import('../server/api/broker/signal.js')),
  'broker/positions':        lazy(() => import('../server/api/broker/positions.js')),
  'broker/webhook':          lazy(() => import('../server/api/broker/webhook.js')),
  'broker/morning-run':      lazy(() => import('../server/api/broker/morning-run.js')),
  'broker/wealthsimple-auth': lazy(() => import('../server/api/broker/wealthsimple-auth.js')),
  'broker/ws-signal':        lazy(() => import('../server/api/broker/ws-signal.js')),
  crypto:               lazy(() => import('../server/api/crypto.js')),
  reddit:               lazy(() => import('../server/api/reddit.js')),
  emergency:            lazy(() => import('../server/api/emergency.js')),
  sp500:                lazy(() => import('../server/api/sp500.js')),
};

function getRoutePath(req) {
  const qp = req?.query?.path;
  if (Array.isArray(qp)) return qp.join('/');
  if (typeof qp === 'string' && qp.length > 0) return qp;
  const raw = (req?.url || '').split('?')[0] || '';
  return raw.replace(/^\/api\/?/, '').replace(/^\/+|\/+$/g, '');
}

const BOT_PATTERNS = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|yandex|baidu|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot/i;

const CACHE_TTL = {
  commodities: 300, crime: 3600, 'fear-greed': 300, earthquakes: 300, events: 600, flights: 120,
  history: 3600, incidents: 600, latest: 60, 'local-events': 600, macro: 3600,
  markets: 60, news: 300, prices: 60, 'stocks-free': 60, traffic: 300,
  weather: 300, 'weather-alerts': 300, wildfires: 600, ontology: 3600, crypto: 60, reddit: 300,
  dispatch: 60, emergency: 60,
};

export default async function handler(req, res) {
  try {
    const ua = req.headers['user-agent'] || '';
    if (BOT_PATTERNS.test(ua)) {
      return res.status(403).json({ error: 'Blocked' });
    }

    const routePath = getRoutePath(req);
    const route = ROUTES[routePath];

    if (!route) {
      return res.status(404).json({ error: `Unknown API route: ${routePath || '(empty)'}` });
    }

    if (req.method === 'GET' && CACHE_TTL[routePath]) {
      const ttl = CACHE_TTL[routePath];
      res.setHeader('Cache-Control', `s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
    }

    return await route(req, res);
  } catch (err) {
    console.error('[GATEWAY] Unhandled error:', err.message, err.stack?.split('\n')[1]);
    if (!res.headersSent) return errorResponse(res, 500, 'Internal server error');
  }
}
