# Opticon - Claude Guide

## Deployment Targets

- Production: `https://opticon.heyitsmejosh.com`
- Docs: `https://heyitsmejosh.com/opticon/`

## What This Project Is

Opticon is a financial terminal app with:

- High-speed simulator UI (`src/App.jsx`)
- Personal finance panel (`src/components/FinancePanel.jsx`) -- portfolio, budget, debt, goals, spending
- Prediction market feed and filters
- Map-first backdrop + overlays (`src/components/LiveMapBackdrop.jsx`)
- Tactical HUD styling pass (grid overlay + live status badge + neon map controls)
- Single serverless API entry (`api/gateway.js`) with handlers under `server/api/`
- Stock data: FMP batch quotes (primary) + Yahoo Finance (fallback)
- Auth system: bcrypt password hashing, httpOnly cookie sessions, email verification
- Portfolio API: KV-backed CRUD (`server/api/portfolio.js`), syncs with CLI via `balance` command
- Geolocation zoom policy: granted GPS uses neighborhood zoom; cached location uses near-neighborhood zoom; IP fallback stays wider.

## Auth System

- `server/api/auth.js` -- register, login, verify-email, me, logout actions
- `src/hooks/useAuth.js` -- auth state hook
- `src/components/LoginPage.jsx` -- login form
- `src/components/RegisterPage.jsx` -- register form with inline pricing
- Sessions: httpOnly secure cookie, stored in Vercel KV (`session:{token}`)
- Users: stored in KV (`user:{email}`)
- Email verification: token stored in KV (`verify:{token}`)

## Finance Panel

- `src/components/FinancePanel.jsx` -- full-screen finance overlay
- `src/hooks/usePortfolio.js` -- portfolio data hook, server sync when authenticated, localStorage fallback
- `src/utils/financeData.js` -- demo data + JSON schema validation
- `server/api/portfolio.js` -- KV-backed portfolio CRUD (get, update, summary)
- PORTFOLIO button in header opens the panel
- Users can import/export JSON balance sheets
- Demo data loads by default
- Live stock prices from useStocks merge into holdings for real-time valuation
- CLI: `~/.local/bin/balance` reads/writes portfolio via API

## Situation Monitor Data Sources

All endpoints are routed through `api/gateway.js` to handlers in `server/api/`.

| Endpoint | Provider | Auth | Status |
|---|---|---|---|
| `/api/flights` | OpenSky Network | Free, no key | Working |
| `/api/traffic` | TomTom Flow + HERE Incidents | `TOMTOM_API_KEY` + `HERE_API_KEY` | **Needs keys** -- falls back to time-based congestion estimates without them |
| `/api/incidents` | OpenStreetMap Overpass | Free, no key | Working |
| `/api/earthquakes` | USGS GeoJSON Feed | Free, no key | Working |
| `/api/events` | GDELT Project | Free, no key | Working |
| `/api/weather-alerts` | -- | -- | Implemented |
| `/api/crime` | -- | -- | Implemented |
| `/api/local-events` | -- | -- | Implemented |
| `/api/news` | GDELT GDoc API | Free, no key | Working (15-min cycle, Jaccard dedup, 30+ city geo-matching) |

### Traffic API Setup (not yet configured)

To enable live traffic data instead of time-based estimates:

1. **TomTom** (traffic flow): Register at https://developer.tomtom.com, get a free-tier API key (2500 req/day)
   - Set Vercel env var: `TOMTOM_API_KEY`
2. **HERE** (traffic incidents): Register at https://platform.here.com, get a freemium API key (250k req/month)
   - Set Vercel env var: `HERE_API_KEY`

Without these keys, `/api/traffic` returns estimated congestion based on time-of-day and day-of-week heuristics. Incident data is omitted entirely.

Notes:
- Map overlays include traffic/construction/seismic/global-event/crime/local-event/news markers.
- News articles appear as blue markers on the map and in the SituationMonitor sidebar.
- Local overlays refresh by current map viewport center.
- Fallback markers are intentionally injected when upstream feeds are sparse, to avoid empty-city states.
- Predictions are shown only when a confident geographic anchor is inferred.

## Local Development

```bash
npm install
npm run dev
```

App URL: `http://localhost:5173`

## Test + Build

```bash
npm test -- --run
npm run build
```

## Deployment Workflow

```bash
git checkout main
git pull
npm test -- --run
git add .
git commit -m "..."
git push origin main
```

Pushing `main` triggers production deploy on Vercel. Custom domain: `opticon.heyitsmejosh.com`.
If Hobby deploys fail with function-count errors, ensure endpoint logic stays in `server/api/` and only `api/gateway.js` is deployed as the runtime function.

## Billing / Upgrade

- Pricing modal offers `Free`, `Starter ($20)`, and `Pro ($50)`.
- Checkout endpoint is `POST /api/stripe?action=checkout` with `{ priceId }`.
- Allowed price IDs are controlled by:
  - `STRIPE_PRICE_ID_STARTER`
  - `STRIPE_PRICE_ID_PRO`
  - `VITE_STRIPE_PRICE_ID_STARTER`
  - `VITE_STRIPE_PRICE_ID_PRO`
- Apple Pay is handled by Stripe Checkout on supported devices once domain verification is enabled in Stripe.

## Stock Data API

- FMP (Financial Modeling Prep) is the primary stock data source. Requires `FMP_API_KEY` env var.
- Yahoo Finance chart API is the fallback when FMP is unavailable or quota exhausted. Yahoo requests are throttled in batches of 10 with 100ms delays to avoid rate limiting.
- 90s cache TTL to stay within FMP 250 req/day free tier.
- Cron job caches all 100 symbols (FMP batch first, Yahoo chunked fallback) to Vercel Blob daily.
- `X-Opticon-Data-Source` header shows which provider served the data (`fmp`/`yahoo`/`mixed`).

## Stripe Setup

To activate paid tiers:

1. Create a Stripe account at https://dashboard.stripe.com/register
2. In Stripe Dashboard, create two Products:
   - **Opticon Starter** ($20/mo recurring)
   - **Opticon Pro** ($50/mo recurring)
3. Copy each product's Price ID (starts with `price_`)
4. Set Vercel env vars:
   - `STRIPE_SECRET_KEY` -- from Stripe Dashboard > Developers > API keys
   - `STRIPE_PRICE_ID_STARTER` -- Price ID for Starter product
   - `STRIPE_PRICE_ID_PRO` -- Price ID for Pro product
   - `VITE_STRIPE_PUBLISHABLE_KEY` -- publishable key (starts with `pk_`)
   - `VITE_STRIPE_PRICE_ID_STARTER` -- same as STRIPE_PRICE_ID_STARTER (needed client-side)
   - `VITE_STRIPE_PRICE_ID_PRO` -- same as STRIPE_PRICE_ID_PRO (needed client-side)
5. For Apple Pay: Stripe Dashboard > Settings > Payment methods > Apple Pay > add + verify domain
6. Webhook (optional): create endpoint at `https://opticon.heyitsmejosh.com/api/stripe?action=webhook` for `checkout.session.completed` events

## Recent Fixes (2026-03-06)

- Theme: added `blue` and `backgroundSecondary` to both themes (fixes invisible Pro button, Current Plan pill, footer)
- PricingPage: vertical scroll + `maxHeight: calc(100dvh - 40px)` on inner container
- Map NavigationControl moved to `bottom-left`
- User pin + local pulse markers split into separate useEffect (renders immediately, not blocked by API)
- useStocks: `cacheAttempted` ref prevents FALLBACK status until cache seed attempt completes

## Current Priorities

- Keep simulator and monitor responsive
- Keep API handlers small and test-covered
- Deduplicate logic before adding new features
- Preserve UI behavior unless explicitly requested

## Roadmap
- [ ] iOS companion app (opticon-ios)
- [ ] Apple Pay integration via Stripe
- [ ] Real-time WebSocket quotes
- [ ] Portfolio analytics dashboard
- [ ] Prediction market accuracy tracking
- [ ] Price alert system with push notifications
