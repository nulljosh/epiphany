# Architecture

Epiphany is a personal intelligence dashboard for your money, location, and markets. The web app runs on Cloudflare Workers. The native apps (iOS, macOS, watchOS) talk to the same backend API. Everything is real-time where possible and cached where it needs to be.

## How it runs

**Web**: A visitor lands on epiphany.heyitsmejosh.com and loads a Vite React app from Cloudflare Pages. The React code lives in `/src` and talks to the API via `/api`. Unauthenticated visitors see the landing page. Authenticated users get a tabbed dashboard with a live map, markets list, portfolio view, and settings.

**iOS/macOS**: A native SwiftUI app in `/ios` and `/Shared` (cross-platform Swift models). At launch, it authenticates with the backend API, then preloads stock prices, portfolio data, and market indicators. The app stores session cookies and credentials in the system keychain. All rendering is SwiftUI; no WebView except for SVG avatar rasterization.

**Backend**: A single Cloudflare Worker function at `/api/gateway.js` routes all API traffic. Critical routes (auth, stocks, markets) are statically imported and fail at build time if broken. Everything else lazy-loads so one bad endpoint doesn't take the whole API down. The Worker reads and writes to Supabase (auth, user data) and Upstash KV (portfolios, preferences, session state).

## API gateway

| File | What it owns |
|---|---|
| `api/gateway.js` | Single entry point, routes all `/api/*` requests. Critical routes statically imported (auth, stocks-free, markets, latest). Non-critical routes lazy-loaded. Cache headers set per route. Bot/crawler traffic blocked (403) |

## Authentication and users

| File | What it owns |
|---|---|
| `server/api/auth.js` + `server/api/auth-helpers.js` | Email/password login, registration, session management via JWT tokens. Supabase under the hood. Login returns a JWT that web stores in cookies, iOS stores in Keychain. No token refresh logic; tokens live for 24 hours |
| `server/api/iap.js` | Validates Apple in-app purchase receipts. Premium tier is Stripe on web, undefined on native (Guideline 3.1.1 exposure). Gate logic lives in `server/api/gates.js` |

## Core market data

| File | What it owns |
|---|---|
| `server/api/stocks-free.js` | Yahoo Finance quotes, free tier, no key needed. Cached 60s. Used by web and watchOS |
| `server/api/stocks.js` | Yahoo Finance with premium features (FMP override if `FMP_API_KEY` is set). iOS/macOS use this. Returns quotes, market cap, P/E ratio, 52-week highs/lows |
| `server/api/prices.js` | Historical price data for a symbol (date range + OHLCV). Cached 60s |
| `server/api/markets.js` | Index snapshot: S&P 500, Nasdaq, Dow Jones, crypto, commodities. Cached 60s. Built from live price calls + manual calculation |
| `server/api/commodities.js` | Gold, silver, crude oil spot prices via Alpha Vantage and other sources. Cached 300s |
| `server/api/crypto.js` | BTC, ETH, major alts via a public API. Cached 60s |
| `server/api/fear-greed.js` | CNN's fear and greed index. Cached 300s |

## Portfolio and brokerage

| File | What it owns |
|---|---|
| `server/api/portfolio.js` | Get/PUT user portfolio (holdings, accounts, budget, debt, goals). Stored in Upstash KV per session. Web and mobile both call this |
| `server/api/portfolio-history.js` | Daily portfolio snapshots for charting net worth over time. Minimal storage; mostly computed on read from `portfolio.js` snapshots |
| `server/api/statements.js` | Bank statements parsing. User uploads CSV files; the backend normalizes them into a standard format |
| `server/api/watchlist.js` | GET/POST favorite stock symbols per user. Stored in Supabase. Validation: 1-5 uppercase letters/digits |
| `server/api/alerts.js` | Price alerts (alert when AAPL > 300 or < 250). Stored in Supabase. Checked in cron or on-demand |
| `server/api/broker/` | SnapTrade multi-broker sync (read-only). POST /api/broker/sync pulls holdings + balances from connected Wealthsimple/Alpaca/IBKR, stores snapshot in KV. GET returns the latest snapshot. Wealthsimple OAuth, Alpaca API key, IBKR coming. Paper trading via Alpaca (`/api/broker/signal`). Morning run (`/api/broker/morning-run.js`) is a cron job running weekday opens, autopilot trades |

## People, ontology, events

| File | What it owns |
|---|---|
| `server/api/people.js` + `server/api/people-index.js` + `server/api/people-crossref.js` | People search: web search + Wikipedia/Crunchbase enrichment. Index stores recent searches. Crossref pulls social links (Twitter, LinkedIn, etc). Stored in Supabase + KV |
| `server/api/people-import.js` | Import contacts from iOS Contacts app (web only via file upload, native via native API). Normalizes and stores |
| `server/api/ontology.js` | Personal knowledge graph. Typed objects (asset, person, event, place, account, transaction, note, alert, decision) with relationships (owns, located_at, mentions, relatedTo, causedBy). CRUD via API. Stored in Supabase. The schema lives in `src/lib/ontology.js` |

## Live situation data

| File | What it owns |
|---|---|
| `server/api/earthquakes.js` | USGS real-time earthquake data. Cached 300s |
| `server/api/weather.js` | Open-Meteo forecast (free, global, no key). Cached 300s |
| `server/api/weather-alerts.js` | NOAA active alerts (US), Environment Canada (CA), Open-Meteo severe weather (global). Cached 300s |
| `server/api/flights.js` | Flight tracking via third-party API. Real IATA codes and route. Cached 120s |
| `server/api/incidents.js` | Police incidents, fire calls, traffic events. Sourced from various public APIs. Cached 600s |
| `server/api/events.js` | Concerts, sports, festivals. Cached 600s |
| `server/api/local-events.js` | Nearby venues and events (restaurants, gas, parks). Uses Yelp API (free tier, photo/review only). Cached 600s |
| `server/api/crime.js` | Crime incidents near a coordinate. Cached 3600s |
| `server/api/traffic.js` | Estimated congestion (time-based heuristic) plus DriveBC active road events. Cached 300s |
| `server/api/wildfires.js` | Active wildfires via EONET/NASA. Cached 1800s |
| `server/api/places.js` | Geocoding and reverse geocoding via Nominatim. Cached 600s |
| `server/api/venue-details.js` | Yelp venue photos, reviews, hours. Cached 86400s |

## News and macro

| File | What it owns |
|---|---|
| `server/api/news.js` | News feed. Google News RSS + GDELT as fallback. Cached 300s. iOS/web both use this |
| `server/api/daily-brief.js` | AI-generated market summary (gainers, losers, summary text). Uses an LLM API. Cached not stored; fresh per request but same format as iOS native brief |
| `server/api/macro.js` | Macro economic indicators (unemployment, inflation, Fed rate, etc). Cached 3600s |
| `server/api/reddit.js` | Trending Reddit posts (finance subreddits). Cached 300s |
| `server/api/sp500.js` | S&P 500 constituents + performance. Cached 3600s |

## Web client (React)

| File | What it owns |
|---|---|
| `src/App.jsx` | Main entry point. Renders login or dashboard based on `useAuth()` state. Handles all tab navigation, data preload on launch. Imports all major hooks and panels |
| `src/pages/LandingPage.jsx` | Unauthenticated landing page. Device frame mockups, feature summary. Not interactive, just marketing |
| `src/pages/AuthPage.jsx` | Login/register/reset-password flow. Links to auth page components |
| `src/components/LoginPage.jsx` | Email/password form. Local form state validated client-side. On submit, calls `useAuth().login()` |
| `src/components/FinancePanel.jsx` | Net worth, debt, goals, budget editor. Biggest component (~1600L). Tabs for each section. Calls `usePortfolio()` for state |
| `src/components/MarketsPanel.jsx` | Stock/commodity/crypto list with search, sort, filters. Inline portfolio box. News drawer with peek/expand. Calls `useStocks()` and `useNews()` |
| `src/components/SituationMonitor.jsx` | Map event timeline (earthquakes, flights, incidents, weather, crime, traffic). Calls `useSituation()` which polls all those endpoints |
| `src/components/LiveMapBackdrop.jsx` | MapLibre GL JS map, 8 toggleable layers (flights, earthquakes, incidents, crime, events, weather, traffic, wildfires). Manages map state and clustering. ~1400L. Yelp venue search integration |
| `src/components/MarketsPanel.jsx` + `src/components/StockDetail.jsx` | Stock detail sheet with charts (line, area, candlestick, Heikin Ashi). Technical indicators (SMA, EMA, RSI, MACD). Trading signals |
| `src/components/` | 26 additional components: AlertsPanel, CommandBar, DailyBrief, EpiphanyFinance, PeoplePanel, Settings, NewsWidget, WeatherWidget, Ticker, Statements, etc. Each is a self-contained panel or overlay |
| `src/hooks/` | 22 custom hooks. Each owns one data domain: `useStocks()`, `usePortfolio()`, `useAlerts()`, `usePolymarket()`, `useSituation()`, `useLivePrices()`, `useOntology()`, `usePeopleIndex()`, `useAuth()`, `useWatchlist()`. All use `useVisibilityPolling()` instead of raw `setInterval` |
| `src/utils/` | Shared logic: `formatting.js` (currency, relative time), `math.js` (Monte Carlo, technical analysis), `broker.js` (trade adapter for cTrader/TradingView alerts), `recommendations.js` (allocation suggestions), `financeData.js` (normalization) |
| `src/layouts/DesktopLayout.jsx` + `src/layouts/MobileLayout.jsx` | Responsive desktop vs mobile layout wrapper. Desktop has sidebar nav + panels. Mobile has tab bar + drawer |

## iOS/macOS native

| File | What it owns |
|---|---|
| `ios/EpiphanyApp.swift` | App entry point. Sets up AppState, shows splash, restores auth on launch, manages onboarding |
| `ios/ContentView.swift` | Tab navigation container (Situation/Markets/Portfolio/Settings). Preloads all market data in parallel at launch |
| `ios/Views/SituationView.swift` | MapKit map with 8 toggleable layers. Venue search. Hardcoded map layers per user setting |
| `ios/Views/MarketsView.swift` | Markets list + inline portfolio summary. Stock detail sheets. News drawer. TickerBarView (horizontal scrolling ticker) |
| `ios/Views/PortfolioView.swift` | Spending forecast chart, holdings, budget breakdown, debt/goals calendar, statements import |
| `ios/Views/SettingsView.swift` | Account profile, avatar, subscription tier, Tally integration, logout. Brokerage connection for sync |
| `ios/Views/AlertsView.swift` | Price alerts list and create sheet |
| `ios/API/EpiphanyAPI.swift` | All HTTP calls. Session cookie + JWT auth. Methods for every endpoint (stocks, portfolio, sync, auth). Error handling with user-facing messages. Implements retry logic for transient failures. ~1000L |
| `ios/Models/AppState.swift` | @Observable shared state object. User, portfolio, watchlist, alerts, UI state flags. Avatar persistence to disk. Keychain integration for credentials. ~680L. Core store for the entire app |
| `ios/Models/` | 8 Swift model files for Codable types: Stock, User, Portfolio (FinanceData), SituationData (earthquakes, flights, incidents, etc). All match the API response JSON |
| `ios/Services/TallyService.swift` | Tally (BNPL) API client. Stores credentials in Keychain. Fetches next payment date + amount |
| `ios/Services/Store.swift` | StoreKit 2 wrapper for the one IAP (Premium). Validates receipt with server |
| `ios/Helpers/` | SVGRasterizer (WKWebView-based SVG-to-UIImage), helpers (formatting, colors, palette), device-frame script for screenshots |
| `Shared/` | 15 Swift files shared between iOS, macOS, watchOS. Data models: FinanceData, Portfolio, Holding, SituationData, NewsArticle, etc. Indicator calculations (SMA, EMA, RSI, MACD, Heikin Ashi). Shared UI components where applicable |

## CLI

| File | What it owns |
|---|---|
| `cli/epiphany-tui.mjs` | Terminal dashboard. Node.js. Reads portfolio from Upstash KV via the API. Renders an ANSI dashboard with net worth, holdings, balances. Single email argument or EPIPHANY_EMAIL env var |

## Testing

| File | What it owns |
|---|---|
| `src/App.test.jsx` | Trading simulator unit tests (position sizing, P&L, Kelly criterion). No API mocking; pure math |
| `src/hooks/useStocks.test.js` | Mock fetch, test symbol batching and retry logic |
| `src/hooks/usePolymarket.test.js` | Mock fetch, test market validation and link parsing |
| `src/hooks/useSituation.test.js` | Mock API responses, test geolocation caching |
| `src/components/Ticker.test.jsx` | Ticker animation state machine |
| `src/utils/math.test.js` | Option pricing, Fibonacci targets |
| `src/lib/ontology.test.js` | Object/relationship creation and validation |
| `ios/Tests/` | 5 XCTest suites for iOS models and calculations (Heikin Ashi, indicators, watchlist, app state) |
| `ios/UITests/` | Screenshot capture for App Store via `PreviewScreenshot.swift` |

## Configuration and deployment

| File | What it owns |
|---|---|
| `vite.config.js` | Vite bundler config. PWA plugin, compression, environment variable loader for statements preview payload |
| `wrangler.toml` | Cloudflare Worker config. Routes, env vars, KV binding, cron trigger for `/api/broker/morning-run` (30 14 * * 1-5 = 9:30am ET weekdays) |
| `vitest.config.js` | Vitest test runner config |
| `eslint.config.js` | Eslint rules for the web codebase |
| `stripe.config.js` | Stripe price ID mapping (starter/pro tiers) |
| `src/config/` | Feature flags and user-specific data. `features.js` maps feature names to tiers. `userProfile.js` holds demo data |

## Gotchas

**Brokerage trading is paper-only on the public demo.** The morning-run cron places orders on Alpaca paper, not live. Wealthsimple and IBKR are read-only sync only; no write path.

**Performance: live prices poll every 60 seconds** (market hours only, via `useVisibilityPolling`). If a tab is hidden, polling pauses and resumes on visibility. Never use raw `setInterval`.

**iOS Keychain stores both** session JWT and brokerage credentials separately. Keychain access is gated behind biometric or passcode prompt on first use, then cached until logout.

**Map layers are many.** SituationMonitor/LiveMapBackdrop fetch from 8+ endpoints in parallel. If one 503s, the map stays responsive and that layer shows stale data from the last successful fetch.

**Statements parsing is lossy.** CSV upload normalizes bank/brokerage exports into a common format (date, description, amount, category). Human review is expected; the system can mis-categorize transactions.

**SVG avatars on web** are converted to PNG on iOS because SwiftUI can't render SVG natively. WKWebView rasterizes at 512x512 and caches the result.

## macOS native

| File | What it owns |
|---|---|
| `macos/OnboardingView.swift` + `macos/OnboardingSlides.swift` | Shared onboarding UX with iOS. Same three-screen flow (accounts, holdings, spending overview) |
| `macos/UITests-mac/MacScreenshot.swift` | Screenshot capture for App Store macOS submission |
| `macos/scripts/screenshot.sh` | Helper to automate screenshot collection |

## watchOS

| File | What it owns |
|---|---|
| `watchos/EpiphanyWatchApp.swift` | Watch app entry point. Single complication: current portfolio value. Fetches live data every 15 minutes or on screen wake |

## Widgets

| File | What it owns |
|---|---|
| `widgets-ios/MonicaWidgets.swift` | iOS lock screen and home screen widgets (iOS 17+). Small lock screen widget shows portfolio value. Medium/large show markets list |
| `widgets-ios/Providers/` | Data providers for each widget. MarketsProvider fetches live quotes for the widget display |
| `widgets-macos/EpiphanyMacWidgets.swift` | macOS widget (menu bar or Notification Center). Shows portfolio snapshot |

## Public web assets

| File | What it owns |
|---|---|
| `index.html` | Root HTML entry point for the Vite app. Loads React into a div, meta tags for PWA |
| `public/onboarding.js` | Legacy onboarding logic, not used in current version |
| `public/privacy.html` + `public/tos.html` | Privacy policy and terms of service pages |

## Test suites

| File | What it owns |
|---|---|
| `tests/` | Integration tests: debt payoff calculations, Heikin Ashi charting, indicator accuracy, worker request handling |

## Utility scripts

| File | What it owns |
|---|---|
| `scripts/check-no-teal-purple.py` | Linter: scans CSS/JS for hardcoded teal/purple colors (design system violation). Part of pre-commit check |
| `scripts/e2e-upgrade.mjs` | End-to-end test: simulates user upgrading from free to paid tier |
| `scripts/kv-portfolio-edit.sh` | Manual KV editing for admin. Fetch, edit, push portfolio JSON |
| `scripts/rotate-keys.sh` | Rotate Stripe/Supabase/Upstash secrets. Not automated; manual run only |
| `scripts/sync-version-badges.js` + `scripts/sync-version.sh` | Keep README version badge, package.json, and CLAUDE.md in sync |
| `scripts/tv-signal-agent.js` | TradingView webhook agent. Receives alerts and places Alpaca paper orders |

## External services

- **Supabase**: Auth, user profiles, ontology, watchlists, alerts, statements
- **Upstash**: KV store for portfolio snapshots, session state, cache
- **Stripe**: Premium tier billing (web only, not native)
- **SnapTrade**: Multi-broker account sync (Wealthsimple, Alpaca, IBKR)
- **Yahoo Finance**: Stock quotes and historical data
- **Alpha Vantage**: Commodity prices (fallback)
- **Open-Meteo**: Weather forecast (free, global, no key)
- **NOAA / Environment Canada**: Weather alerts
- **USGS**: Earthquake data
- **EONET / NASA**: Wildfire tracking
- **Yelp**: Venue details (photos, reviews, hours)
- **Nominatim**: Geocoding
- **Google News / GDELT**: News feed
- **CNN**: Fear & Greed Index

## Storage schema

**Supabase tables:**
- `auth.users` - Supabase managed, email + password hash
- `public.user_profiles` - Tier, subscription status, metadata
- `public.watchlists` - Symbols per user
- `public.price_alerts` - Alert conditions and trigger status
- `public.ontology_objects` - Knowledge graph nodes
- `public.ontology_relationships` - Knowledge graph edges
- `public.statements` - Parsed bank statements
- `public.people_index` - Cached people search results

**Upstash KV keys (per user session):**
- `portfolio:{email}` - Holdings, accounts, budget, debt, goals
- `portfolio-history:{email}` - Daily snapshots for charting
- `brokerage-snapshot:{email}` - Last SnapTrade sync result
- `wealthsimple-tokens:{email}` - OAuth tokens (encrypted)
