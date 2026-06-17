# Epiphany

v1.10.4 -- Personal intelligence platform. Palantir for regular people.

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
npm test -- --run
npm run build
```

Deploy: Vercel. Repo: github.com/nulljosh/epiphany

## Key Systems

- **Gateway**: `api/gateway.js` -- critical routes static-imported; everything else lazy-loaded
- **Auth**: `server/api/auth.js`, `server/api/auth-helpers.js`
- **Map**: `src/components/LiveMapBackdrop.jsx` (11 data layers, MapLibre GL)
- **Local events/places**: `server/api/local-events.js` tags every result with `kind` — `place` (Wikipedia towns/cities, OSM venues/parks) vs `event` (PredictHQ, Eventbrite, news RSS). Detail views (iOS/macOS `SituationView`, web popup) label "Place" vs "Event" and never call a town an event. Wikipedia places carry a lead `image` (pageimages) and a full intro extract (`exintro`+`exchars=600`, not `exsentences` which truncated on abbreviation periods like "(pop. approx."). Reviews/ratings are a gated follow-up — needs `GOOGLE_PLACES_API_KEY` (none set, no fake data).
- **KV**: `server/api/_kv.js` (Upstash Redis) — always import via `getKv()`, never `@vercel/kv` directly
- **Stocks**: `server/api/stocks-free.js` (web + watchOS) and `server/api/stocks.js` (iOS/macOS). Fundamentals from Yahoo v10 quoteSummary authenticated with cookie+crumb. Optional `FMP_API_KEY` in Vercel overrides Yahoo.
- **History**: `server/api/history.js` -- Yahoo Finance proxy. Accepts range (1d/5d/1mo/3mo/6mo/1y/2y/5y/10y/ytd/max) + interval (1m/5m/15m/1d etc). iOS maps 1m→(1d,1m), 15m→(5d,15m), max→(max,1d).
- **Avatar**: `server/api/avatar.js` -- accepts JPEG or SVG (`format: 'svg'`), stores to Vercel Blob. Web generates 8-bit pixel art SVG; iOS/macOS use photo picker JPEG. iOS rasterizes SVG avatars via `SVGRasterizer.swift` (WKWebView snapshot) when fetching web-uploaded SVGs.
- **Brokerage sync**: `server/api/broker/sync.js` — SnapTrade read-only sync of holdings + cash. Requires `SNAPTRADE_CLIENT_ID` + `SNAPTRADE_CONSUMER_KEY` in Vercel. UI at Settings → Brokerage.
- **TradingView MCP**: `.mcp.json` wired to `_external/tradingview-mcp/src/server.js` — CDP tools for chart analysis and Pine Script dev.
- **Landing Page**: `src/pages/LandingPage.jsx` + `src/pages/landing.css` -- shown to unauthenticated visitors before auth flow. Fraunces serif headlines, animated node-graph canvas, scrolling ticker, feature/pricing sections. Gate in `App.jsx` via `showLanding` state.
- **Finance/Roadmap**: `src/components/EpiphanyFinance.jsx` — spending history, tracker, and 17-year forecasts. Wired to Portfolio → Roadmap tab.
- **Roadmap**: `ROADMAP.md`
