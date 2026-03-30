// Monica API Gateway - single serverless function routing
import auth from '../server/api/auth.js';
import commodities from '../server/api/commodities.js';
import crime from '../server/api/crime.js';
import defuddle from '../server/api/defuddle.js';
import cron from '../server/api/cron.js';
import earthquakes from '../server/api/earthquakes.js';
import events from '../server/api/events.js';
import flights from '../server/api/flights.js';
import history from '../server/api/history.js';
import incidents from '../server/api/incidents.js';
import latest from '../server/api/latest.js';
import localEvents from '../server/api/local-events.js';
import macro from '../server/api/macro.js';
import markets from '../server/api/markets.js';
import news from '../server/api/news.js';
import prices from '../server/api/prices.js';
import signals from '../server/api/signals.js';
import statements from '../server/api/statements.js';
import stocks from '../server/api/stocks.js';
import stocksFree from '../server/api/stocks-free.js';
import stripe from '../server/api/stripe.js';
import stripeWebhook from '../server/api/stripe-webhook.js';
import traffic from '../server/api/traffic.js';
import validateLink from '../server/api/validate-link.js';
import weatherAlerts from '../server/api/weather-alerts.js';
import weather from '../server/api/weather.js';
import webhook from '../server/api/webhook.js';
import wildfires from '../server/api/wildfires.js';
import people from '../server/api/people.js';
import peopleIndex from '../server/api/people-index.js';
import peopleEnrich from '../server/api/people-enrich.js';
import peopleCrossref from '../server/api/people-crossref.js';
import peopleImport from '../server/api/people-import.js';
import peopleAutoEnrich from '../server/api/people-auto-enrich.js';
import portfolio from '../server/api/portfolio.js';
import watchlist from '../server/api/watchlist.js';
import alerts from '../server/api/alerts.js';
import avatar from '../server/api/avatar.js';
import ai from '../server/api/ai.js';
import dailyBrief from '../server/api/daily-brief.js';
import ontology from '../server/api/ontology.js';
import portfolioHistory from '../server/api/portfolio-history.js';
import brokerSignal from '../server/api/broker/signal.js';
import brokerPositions from '../server/api/broker/positions.js';
import brokerWebhook from '../server/api/broker/webhook.js';
import brokerMorningRun from '../server/api/broker/morning-run.js';

const ROUTES = {
  ai,
  auth,
  'daily-brief': dailyBrief,
  commodities,
  crime,
  cron,
  defuddle,
  earthquakes,
  events,
  flights,
  history,
  incidents,
  latest,
  'local-events': localEvents,
  macro,
  markets,
  news,
  people,
  'people-index': peopleIndex,
  'people-enrich': peopleEnrich,
  'people-crossref': peopleCrossref,
  'people-import': peopleImport,
  'people-auto-enrich': peopleAutoEnrich,
  prices,
  signals,
  statements,
  stocks,
  'stocks-free': stocksFree,
  stripe,
  'stripe-webhook': stripeWebhook,
  traffic,
  'validate-link': validateLink,
  'weather-alerts': weatherAlerts,
  weather,
  webhook,
  wildfires,
  portfolio,
  watchlist,
  alerts,
  avatar,
  ontology,
  'portfolio/history': portfolioHistory,
  'broker/signal': brokerSignal,
  'broker/positions': brokerPositions,
  'broker/webhook': brokerWebhook,
  'broker/morning-run': brokerMorningRun,
};

function getRoutePath(req) {
  const qp = req?.query?.path;
  if (Array.isArray(qp)) return qp.join('/');
  if (typeof qp === 'string' && qp.length > 0) return qp;

  const raw = (req?.url || '').split('?')[0] || '';
  return raw.replace(/^\/api\/?/, '').replace(/^\/+|\/+$/g, '');
}

// Bot user-agent patterns that burn invocations for no reason
const BOT_PATTERNS = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|yandex|baidu|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot/i;

// GET-only routes safe to cache at the Vercel edge (seconds)
const CACHE_TTL = {
  commodities: 300,
  crime: 3600,
  earthquakes: 300,
  events: 600,
  flights: 120,
  history: 3600,
  incidents: 600,
  latest: 60,
  'local-events': 600,
  macro: 3600,
  markets: 60,
  news: 300,
  prices: 60,
  'stocks-free': 60,
  traffic: 300,
  weather: 300,
  'weather-alerts': 300,
  wildfires: 600,
  ontology: 3600,
};

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  if (BOT_PATTERNS.test(ua)) {
    return res.status(403).json({ error: 'Blocked' });
  }

  const routePath = getRoutePath(req);
  const route = ROUTES[routePath];

  if (!route) {
    return res.status(404).json({ error: `Unknown API route: ${routePath || '(empty)'}` });
  }

  // Set Vercel edge cache for safe GET routes -- repeat requests skip function invocation
  if (req.method === 'GET' && CACHE_TTL[routePath]) {
    const ttl = CACHE_TTL[routePath];
    res.setHeader('Cache-Control', `s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
  }

  return route(req, res);
}
