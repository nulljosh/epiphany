// Opticon API Gateway - single serverless function routing
import auth from '../server/api/auth.js';
import commodities from '../server/api/commodities.js';
import crime from '../server/api/crime.js';
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
import portfolio from '../server/api/portfolio.js';
import watchlist from '../server/api/watchlist.js';
import alerts from '../server/api/alerts.js';
import avatar from '../server/api/avatar.js';
import portfolioHistory from '../server/api/portfolio-history.js';
import brokerSignal from '../server/api/broker/signal.js';
import brokerPositions from '../server/api/broker/positions.js';
import brokerWebhook from '../server/api/broker/webhook.js';
import brokerMorningRun from '../server/api/broker/morning-run.js';

const ROUTES = {
  auth,
  commodities,
  crime,
  cron,
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
  portfolio,
  watchlist,
  alerts,
  avatar,
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

export default async function handler(req, res) {
  const routePath = getRoutePath(req);
  const route = ROUTES[routePath];

  if (!route) {
    return res.status(404).json({ error: `Unknown API route: ${routePath || '(empty)'}` });
  }

  return route(req, res);
}
