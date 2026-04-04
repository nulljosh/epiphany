# Monica Roadmap

## Critical Fixes -- RESOLVED (2026-04-01)

### 1. STALE indicator / heartbeat -- DONE
- SourceHealth component works (green/amber/red dots with age display)

### 2. Macro pulse strip -- DONE  
- Already renders dynamically from `/api/macro` data (not hardcoded)

### 3. Map layers -- DONE (partial)
- All 11 layers rendering: flights, earthquakes, traffic, weather, crime, local events, wildfires, news, incidents, predictions, heatmap
- hasSource() gate removed, coord validation added, flights fetch connected
- Stale standalone API files removed (were shadowing gateway) -- 2026-04-01
- Free sources working: USGS earthquakes, Overpass incidents, GDELT events/news, OpenSky flights, NASA EONET wildfires
- Dead keys: TomTom (403), HERE (401) -- need replacement (see Tech Debt #11)

### 4. Ticker -- DONE
- stocks-free endpoint returns live data, ticker populates on load

## Monetization ($1/week)

### 5. Stripe subscription flow
- Already have: `server/api/stripe.js`, `server/api/stripe-webhook.js`, `user.tier` in KV
- **TODO**:
  - Create `$1/week` price in Stripe dashboard
  - Update upgrade button to create checkout session
  - Webhook handler to upgrade `user.tier` on payment
  - Feature gate: check tier before serving AI endpoint, ontology writes, portfolio tools

### 6. Free vs Premium ($1/wk)
| Free | Premium |
|---|---|
| Map + all data layers | AI Analyst (Claude) |
| Situation monitor (read) | Portfolio + watchlist |
| Stock data + ticker | Ontology writes + batch |
| Weather/quakes/traffic | Deep news + crime data |

## Polish

### 7. Avatar sync (iOS/web) -- DONE (2026-04-01)
- Web: refreshUser() after upload syncs globally, removed redundant local state
- Server: avatarUrl stored in KV, served via `/api/auth?action=me`
- Network errors in checkSession no longer log user out

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

### 11. Env vars audit -- PARTIALLY DONE (2026-04-01)
Added to Vercel:
- `TOMTOM_API_KEY` -- real traffic flow data
- `TICKETMASTER_API_KEY` -- local event listings
Still missing / dead keys:
- `BLOB_READ_WRITE_TOKEN` - breaks `/api/latest`
- `TOMTOM_API_KEY` - DEAD (403 Forbidden). Get new key: https://developer.tomtom.com/user/register
- `HERE_API_KEY` - DEAD (401 Unauthorized). Get new key: https://platform.here.com/sign-up
- `FIRMS_MAP_KEY` - higher-res wildfire data. Get key: https://firms.modaps.eosdis.nasa.gov/api/area/
- `TICKETMASTER_API_KEY` - local events. Get key: https://developer.ticketmaster.com/products-and-docs/apis/getting-started/
- `FMP_API_KEY` - stock data (primary). Get key: https://site.financialmodelingprep.com/developer/docs

### 12. Error resilience -- DONE (2026-04-02)
- `fetchJsonGraceful` already checks `res.ok` before parsing
- iOS/macOS decode errors now log raw response body for debugging

### 13. Gateway stability
- Single point of failure: one bad import kills ALL routes (people-auto-enrich incident)
- **Fix**: Dynamic imports with try/catch per route, or split into separate serverless functions for critical paths (auth, stocks)

## New Features (2026-04-02)

### 14. Double star watchlist fix -- DONE
- Watchlisted stocks appeared in both Watchlist section and All Markets list (iOS + web)
- Fixed: filteredItems now excludes watchlisted symbols from main list

### 15. Polymarket whale tracking -- DONE
- `/api/polymarket-whales` fetches large trades from Gamma API
- Aggregates by wallet, surfaces top traders and recent whale moves
- Rendered in SituationMonitor as collapsible whale activity section

### 16. Tally payday on web -- DONE
- SituationMonitor fetches `/api/tally?action=next-payment` and shows inline countdown

### 17. Remaining from integrate.md
- Map event UX improvements (Republic SF-inspired filtering, event cards)
- TradingView widget embedding (Pine Scripts exist, need chart widgets)
- Service BC location markers on map (for Tally integration)
