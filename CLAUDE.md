# Opticon - Claude Guide

## Design Rules

- **Mobile-first CSS**: All layouts must be designed mobile-first. Start with single-column/stacked layouts, then use `@media (min-width: 768px)` to add desktop grid columns. Never start with desktop and add mobile breakpoints after.

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

## Development

```bash
npm install && npm run dev   # localhost:5173
npm test -- --run && npm run build
git push origin main         # triggers Vercel production deploy
```

Keep endpoint logic in `server/api/`; only `api/gateway.js` deploys as the runtime function.

## Stock Data API

- FMP (Financial Modeling Prep) is the primary stock data source. Requires `FMP_API_KEY` env var.
- Yahoo Finance chart API is the fallback when FMP is unavailable or quota exhausted. Yahoo requests are throttled in batches of 10 with 100ms delays to avoid rate limiting.
- 90s cache TTL to stay within FMP 250 req/day free tier.
- Cron job caches all 100 symbols (FMP batch first, Yahoo chunked fallback) to Vercel Blob daily.
- `X-Opticon-Data-Source` header shows which provider served the data (`fmp`/`yahoo`/`mixed`).

## Stripe / Billing

Pricing: `Free`, `Starter ($20)`, `Pro ($50)`. Checkout via `POST /api/stripe?action=checkout` with `{ priceId }`. Apple Pay handled by Stripe Checkout on supported devices.

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

