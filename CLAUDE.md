# Epiphany

v2.1.1 -- Personal intelligence platform. Palantir for regular people.

**Latest:** 373 passing tests. Input validation hardened (email RFC 5322, symbol constraints). Mock factories consolidated, -100 lines duplicate code. Account/auth comprehensive (59 tests), watchlist protected (21 tests), iOS/macOS unit tests (42 tests).

## Rules

- Map stays steady -- no jumps on load, no flashing on state changes
- No fake prices before real data arrives
- Mobile-first layout
- Web: dark only (Gotham brand, hardcoded dark surfaces). Native (iOS/macOS/watchOS): follows system appearance via adaptive `Palette`
- iOS app: four tabs (Situation, Markets, Portfolio, Settings)
- Web app: epiphany.heyitsmejosh.com
- Never use raw `setInterval` for API polling -- always use `useVisibilityPolling` from `src/hooks/useVisibilityPolling.js`

## Run

```bash
npm install && npm run dev
npm test -- --run          # 369 tests pass (web + iOS + macOS)
npm run build
```

Deploy: Vercel. Repo: github.com/nulljosh/epiphany

## Tests — 373 passing, hardened input validation

**Web (Node/Vitest):**
- `tests/api/auth.test.js` — 42 tests: register, login, logout, email verification, password reset, account changes, E2E signup flow, **email validation** (RFC 5322)
- `tests/api/watchlist.test.js` — 21 tests: watchlist CRUD (GET/POST/DELETE), symbol normalization, auth + user isolation, **symbol validation** (1-5 chars A-Z/0-9/.), invalid input edge cases
- `tests/api/_mocks.js` — shared mock factories (consolidated createReqRes, seedUser, createMockKV)

**Validations Added:**
- Email: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (400 if invalid)
- Symbol: `/^[A-Z0-9.]{1-5}$/` (400 if invalid)
- Prevents silent failures (registration, watchlist operations)

**iOS (`ios/EpiphanyTests/AppStateTests.swift`):**
- 21 unit tests: auth state, login/register, logout data clearing, account operations, watchlist filtering, local favorites, brokerage persistence, error handling, data staleness, alert filtering

**macOS (`macos/EpiphanyTests/AppStateTests.swift`):**
- 21 unit tests (shared AppState logic with iOS)

## Key Systems

- **Gateway**: `api/gateway.js` -- critical routes static-imported; everything else lazy-loaded
- **Auth**: `server/api/auth.js` (register/login/logout/verify-email/forgot-password/reset-password/change-email/change-password/delete-account), `server/api/auth-helpers.js` (session/cookie parsing). Full test coverage: 40 tests including E2E signup → verification → login
- **Map**: `src/components/LiveMapBackdrop.jsx` (11 data layers, MapLibre GL)
- **Local events/places**: `server/api/local-events.js` tags every result with `kind` — `place` (Wikipedia towns/cities, OSM venues/parks) vs `event` (PredictHQ, Eventbrite, news RSS). Detail views (iOS/macOS `SituationView`, web popup) label "Place" vs "Event" and never call a town an event. Wikipedia places carry a lead `image` (pageimages) and a full intro extract (`exintro`+`exchars=600`, not `exsentences` which truncated on abbreviation periods like "(pop. approx."). Reviews/ratings are a gated follow-up — needs `GOOGLE_PLACES_API_KEY` (none set, no fake data).
- **KV**: `server/api/_kv.js` (Upstash Redis) -- trims env var whitespace at load; wraps get/set/del to catch UrlError; always import via getKv(), never @vercel/kv directly
- **Stocks**: `server/api/stocks-free.js` (web + watchOS) and `server/api/stocks.js` (iOS/macOS). marketCap + P/E come from **Yahoo v10 quoteSummary, authenticated with a cookie+crumb** (`getYahooCrumb()` in `stocks-shared.js`, 1h cached, refresh-on-401). This is the real fix (2026-05-30, v1.10.1/1.10.2): there has never been an `FMP_API_KEY` in prod, and Yahoo v7/v10 now 401 without a crumb -- so every fundamentals source was failing and the pipeline fell to the v8 chart endpoint, which has no marketCap/P/E. Verified live: AAPL marketCap/peRatio non-null, `source:yahoo`. v10 supplement calls are chunked (5 at a time) to dodge Yahoo's 429. FMP path still exists and self-disables when no key is set -- it's an optional override, add `FMP_API_KEY` to Vercel to make it primary. Fresh KV cache gated on >=50% fundamentals coverage. Cache key `stocks:free:v2:*`.
- **History**: `server/api/history.js` -- Yahoo Finance proxy. Accepts range (1d/5d/1mo/3mo/6mo/1y/2y/5y/10y/ytd/max) + interval (1m/5m/15m/1d etc). iOS maps 1m→(1d,1m), 15m→(5d,15m), max→(max,1d).
- **Avatar**: `server/api/avatar.js` -- accepts JPEG or SVG (`format: 'svg'`), stores to Vercel Blob. Web generates 8-bit pixel art SVG; iOS/macOS use photo picker JPEG. iOS rasterizes SVG avatars via `SVGRasterizer.swift` (WKWebView snapshot) when fetching web-uploaded SVGs.
- **Brokerage sync**: `server/api/broker/sync.js` (gateway route `broker/sync`) -- read-only SnapTrade pull of holdings + cash. No-ops with `{ skipped: true }` until `SNAPTRADE_CLIENT_ID` + `SNAPTRADE_CONSUMER_KEY` are set in Vercel. Adapter `src/utils/brokers/snaptrade.js` supports holdings/cash AND live order placement (`placeOrder` hits `/trade/impact` + `/trade/{tradeId}`); `getHoldings()` uses `/accounts/{id}/positions` (the combined `/holdings` endpoint was retired by SnapTrade -- 410 Gone, fixed v1.10.0). UI: "Brokerage" tab in `Settings.jsx` -- one button hits `/api/broker/sync`; first call returns `linkUrl` (hosted portal opens in a popup), repeat call returns + renders holdings/cash. Keys live in keychain (`snaptrade-client`/`snaptrade-consumer`, account `epiphany`). Native iOS/macOS parity is a fast-follow (open `linkUrl` via SFSafariViewController).
- **TradingView MCP**: `.mcp.json` wired to `_external/tradingview-mcp/src/server.js` — 78 CDP tools for chart analysis and Pine Script dev. Start TradingView Desktop with `--remote-debugging-port=9222` before using.
- **Landing Page**: `src/pages/LandingPage.jsx` + `src/pages/landing.css` -- shown to unauthenticated visitors before auth flow. v2 (2026-06-12, from Claude Design handoff): Inter typography, blue accent `#0A84FF`, glass morphism, three iPhone-17-Pro screen mockups (Situation map / Markets / AI / People), scrolling ticker, pricing, final CTA. All CSS scoped under `.lp`. Demo data in mockups/ticker is intentionally static. Gate in `App.jsx` via `showLanding` state.
- **Finance/Roadmap**: `src/components/EpiphanyFinance.jsx` -- replaces RoadmapProjection. Spending history (Oct '25–Apr '26, stacked bar), May tracker with $400 target, 17-year RDSP/TFSA forecast (uses `src/utils/roadmapSim.js`), 5 parameter sliders. Wired to Portfolio → Roadmap tab in FinancePanel.jsx.
- **Autopilot**: `server/api/broker/morning-run.js` (gateway `broker/morning-run`) -- live-only by default (paper kept as dormant opt-in, no UI). Triggers: Vercel daily cron (14:30 UTC, Hobby limit) + GitHub Actions hourly ticks (`.github/workflows/autopilot.yml`, needs repo secret `CRON_SECRET` = Vercel env `CRON_SECRET`). Handler guards 9:30–16:00 ET Mon–Fri and dedupes one run/hour via KV `autopilot:run:{iso-hour}`; `?force=1` bypasses for testing. iOS/macOS cards have in-app Connect (POST `/api/broker/sync` → open `linkUrl`).
- **Watchlist**: `server/api/watchlist.js` -- read-only Supabase table (user_email, symbol, added_at). GET (filtered by user), POST (add symbol with dup check), DELETE (remove). 19 tests cover CRUD, auth, user isolation, symbol normalization
- **Roadmap**: `ROADMAP.md`
