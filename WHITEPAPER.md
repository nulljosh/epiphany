# Epiphany -- Technical Whitepaper

**v1.0.2-beta** | April 2026

## Overview

Epiphany is a personal intelligence platform. It aggregates live geospatial data, financial markets, prediction markets, people intelligence, and news into a single map-first interface. Palantir for regular people.

Live at [epiphany.heyitsmejosh.com](https://epiphany.heyitsmejosh.com). Companion apps for iOS, macOS, and watchOS.

## Architecture

```
Browser / iOS / macOS / watchOS
              |
       Vercel Gateway (api/gateway.js)
              |
  +-----------+-----------+-----------+
  |           |           |           |
Auth      11 Data      AI Chat     Stripe
(KV)      Sources     (Claude)   (billing)
```

**Gateway**: Single serverless entry point. Critical routes (auth, stocks, markets) are static imports. Everything else lazy-loads with try/catch isolation -- one broken route cannot crash others. Edge caching with per-route TTLs. Bot blocking.

## Data Sources

| Layer | Source | Auth | Notes |
|-------|--------|------|-------|
| Earthquakes | USGS | None | Global, real-time |
| Flights | OpenSky Network | Optional | Rate-limited unauthenticated |
| Incidents | OpenStreetMap Overpass | None | Police, fire, hospitals, construction, cameras |
| Traffic | TomTom / HERE | API key | Keys need renewal |
| Weather | NWS + Environment Canada | None | Alerts only |
| Crime | GDELT + local feeds | None | Geo-tagged crime events |
| Local Events | Wikipedia GeoSearch, Ticketmaster, PredictHQ | Mixed | Wikipedia is the free universal fallback |
| Wildfires | NASA EONET / FIRMS | Optional | Satellite fire detections |
| News | GDELT | None | Global news with geo-extraction |
| Predictions | Polymarket | None | Whale tracking, probability markets |
| Heatmap | Derived | N/A | Client-side density from all sources |

All sources fetch in parallel every 120 seconds. Polling pauses when the tab is hidden (`useVisibilityPolling`). Each source has its own error boundary -- failures return empty arrays, never block other sources.

**Geo-matching rule**: Markers only render with real geographic coordinates. No synthetic scatter, no estimated positions, no placeholder data.

## Map Engine

MapLibre GL JS with CARTO basemaps (dark/light). DOM-based markers with CSS pulse animations per layer type. Heatmap layer computed from all geo-tagged data points.

Geolocation chain: browser GPS > cached position (30 min TTL) > IP fallback. No jump on load -- position resolved before first render when cached.

Layer toggles in Settings control which marker types render. The `mapLayers` state is passed through and checked per layer section in the rendering effect.

## Financial Data

- **Stocks**: Yahoo Finance via `/api/stocks-free` (chunked 50/batch, 3 retries, exponential backoff, static fallback prices when all APIs fail)
- **Commodities**: Gold, silver, crude oil
- **Predictions**: Polymarket (top markets by volume, whale trade aggregation)
- **Portfolio**: Holdings + debt + spending in Vercel KV, PDF statement upload for analysis
- **Macro**: Unemployment, PCE, retail sales, consumer confidence, jobless claims

Ticker bar always shows data. If the watchlist filters to zero matches, falls back to full stock list. If live APIs fail entirely, static FALLBACK_DATA prices render.

## AI Analyst

Claude streaming via SSE. 10 tool functions executing in parallel when independent: stock lookup, portfolio query, news search, macro data, ontology CRUD, alert management, watchlist ops, note creation.

## People Intelligence

Three-tier search with cascading timeouts:
1. Google Custom Search (5s timeout)
2. DuckDuckGo (3s timeout)
3. Wikipedia (3s timeout, universal fallback)

Social link detection across 10 platforms. AI enrichment: company, location, sentiment, key facts, associates, industry tags. Cross-referencing against GDELT for news mentions. Relationship graph rendered client-side.

Search cancels previous in-flight requests via AbortController. 12s hard timeout with error display and retry button.

## Auth and Billing

- **Sessions**: bcrypt, tokens in Vercel KV (Upstash Redis)
- **Billing**: Stripe Checkout -- Free / $1 per week (Premium)
- **Feature gates**: Free gets map + ticker + situation monitor. Premium unlocks AI, portfolio, ontology, deep data.

## Navigation

Single-level top nav: **Situation | Markets | Portfolio | People | Settings**. No nested tabs. Map always visible as background. Panels slide from right (desktop) or bottom sheet (mobile). Keyboard shortcuts 1-5 for tabs, Cmd+K for command bar.

## Companion Apps

| Platform | Framework | Notes |
|----------|-----------|-------|
| iOS | SwiftUI | 4 tabs, MapKit, parallel data preload, 2-retry networking |
| macOS | SwiftUI | 5-section bottom nav, 4-column grids, MapKit |
| watchOS | SwiftUI | Complications only |
| Widgets | SwiftUI | iOS + macOS widget extensions |

All native apps share the API backend. URLSession with cookie persistence. People view unified: search at top, index grid below, relationship graph at bottom.

## Repo Structure

```
epiphany/
  api/              Vercel serverless gateway
  server/           API route handlers (auth, stocks, AI, map sources)
  src/              React web app (Vite)
  ios/              iPhone app (SwiftUI)
  macos/            Mac app (SwiftUI)
  watchos/          Watch app (SwiftUI)
  widgets-ios/      iOS widget extension
  widgets-macos/    macOS widget extension
  tradingview/      Pine Script strategies
  public/           Static assets
  scripts/          Build scripts
  tests/            Vitest + Playwright
```

## Performance

- **Cold start**: ~2s (Vercel Fluid Compute)
- **Data refresh**: 120s polling, paused when hidden
- **Bundle**: ~1MB gzipped (MapLibre GL is majority)
- **Tests**: 306 across 23 files

## License

MIT 2026, Joshua Trommel
