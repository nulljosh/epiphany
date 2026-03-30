# Monica Roadmap

## Critical Fixes (ship this week)

### 1. STALE indicator / heartbeat
- `/api/latest` fails because `BLOB_READ_WRITE_TOKEN` not set on Vercel
- **Fix**: Set the env var via `vercel env add BLOB_READ_WRITE_TOKEN`, or make the heartbeat endpoint fall back gracefully instead of 500ing when Blob isn't configured

### 2. Macro pulse strip (hardcoded)
- `SituationMonitor.jsx:302-306` has hardcoded "AI Bubble: Mag7 = 35% S&P" etc.
- **Fix**: Pull from `/api/macro` endpoint (already exists), cache in useSituation, render dynamically

### 3. Map layers (never implemented)
- Settings toggles exist (`mapLayers` state), data is fetched via useSituation, but **no maplibre layer code** connects them to actual map overlays
- LiveMapBackdrop only renders: user location (red dot), event markers (blue dots from GDELT/news), and the base map tiles
- **Fix**: For each layer toggle, add maplibre source+layer:
  - **Flights**: GeoJSON point layer from `flights[]` array (airplane icons)
  - **Earthquakes**: Circle layer from `earthquakes[]` (radius = magnitude)
  - **Traffic**: Heat layer from traffic flow data
  - **Weather**: Tile overlay from OpenWeatherMap tiles (free)
  - **News/Events**: Already partially working (blue dots)
  - **Predictions**: Markers for Polymarket geo-tagged events
  - **Heatmap**: Composite heat layer of all active data

### 4. Ticker not visible
- Ticker component works (auto-scroll marquee) but `tickerItems` depends on `stocks` being loaded
- Verify stocks data is loading; if stocks-free endpoint returns data, ticker should populate
- May be a CSS visibility issue at certain viewport sizes

## Monetization ($1/week)

### 5. Stripe subscription flow
- Already have: `server/api/stripe.js`, `server/api/stripe-webhook.js`, `user.tier` in KV
- **TODO**:
  - Create `$1/week` price in Stripe dashboard
  - Update upgrade button to create checkout session
  - Webhook handler to upgrade `user.tier` on payment
  - Feature gate: check tier before serving AI endpoint, ontology writes, portfolio tools

### 6. Free vs Paid feature matrix
| Free (hook) | Paid $1/wk |
|---|---|
| Map + all data layers | AI Analyst (Claude) |
| Situation monitor (read) | Portfolio + watchlist |
| Stock data + ticker | Ontology writes + batch |
| Weather/quakes/traffic | Polymarket, crime, GDELT deep |

## Polish

### 7. Avatar sync (iOS/web)
- Web stores nothing, iOS stores locally
- **Fix**: Add `avatarUrl` field to KV user record. Upload to Vercel Blob, store URL. Both platforms read from `/api/auth?action=me`

### 8. Upgrade button UX
- Current UPGRADE button in header needs to link to Stripe checkout
- Add a proper upgrade modal with pricing tiers (reuse RegisterPage tier cards)

### 9. Data source expansion
Current sources:
- **Markets**: Yahoo Finance (stocks-free), Polymarket
- **News/Events**: GDELT, local-events
- **Geo**: OpenSky (flights), TomTom/HERE (traffic), USGS (earthquakes), NWS (weather alerts)
- **Macro**: hardcoded (needs fix)

Add next:
- **Reuters/AP wire** via NewsAPI or Mediastack (free tier)
- **Reddit** trending via old.reddit.com JSON endpoints (free, no API key)
- **SEC filings** via EDGAR RSS (free)
- **Crypto** via CoinGecko (free tier)
- **Local police/fire** via PulsePoint or Broadcastify (if available for Langley)
- **Canadian-specific**: StatCan releases, Bank of Canada rate decisions

### 10. iOS/macOS sync check
- Verify auth flow works on iOS (Apple Sign-In + email/password)
- Verify settings, watchlist, portfolio persist across platforms via KV
- Profile photo: see #7

## Tech Debt

### 11. Env vars audit
Missing on Vercel (causes silent failures):
- `BLOB_READ_WRITE_TOKEN` - breaks `/api/latest`
- `TOMTOM_API_KEY` - traffic falls back to estimates
- `HERE_API_KEY` - no traffic incidents
- `RESEND_API_KEY` - no verification/reset emails

### 12. Error resilience
- `fetchJsonGraceful` doesn't check `res.ok` -- non-200 responses with non-JSON bodies cause cryptic "not valid JSON" errors
- **Fix**: Check `res.ok` before parsing, return structured error on failure

### 13. Gateway stability
- Single point of failure: one bad import kills ALL routes (people-auto-enrich incident)
- **Fix**: Dynamic imports with try/catch per route, or split into separate serverless functions for critical paths (auth, stocks)
