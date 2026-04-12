# Architecture

## Web App

```
Browser
  └── React 19 (Vite, PWA)
        ├── LiveMapBackdrop.jsx — MapLibre GL, 11 data layers
        ├── AiPanel.jsx — Claude streaming SSE, 10 tools
        ├── src/pages/ — Markets, Portfolio, People, Settings, Situation
        └── api/gateway.js — Vercel serverless entry point
              ├── Critical imports: auth, stocks-free, markets
              └── Lazy imports: all other routes (isolated error handling)
```

## Backend Routes (server/api/)

| Category | Files |
|---|---|
| Auth | auth.js, auth-helpers.js |
| Markets | stocks-free.js, commodities.js, crypto.js, prices.js, markets.js |
| Map Data | flights.js, earthquakes (gateway), weather.js, incidents (gateway), crime (gateway), events (gateway), wildfires (gateway) |
| Finance | portfolio.js, watchlist.js, alerts.js, statements.js, tally.js |
| People | people.js, people-index.js, people-enrich.js |
| AI | ai.js (Claude Sonnet, streaming SSE, 10 tools) |
| Knowledge | ontology.js (9 object types, 6 relationship types) |
| Billing | stripe.js, stripe-webhook.js |

## Data Storage

- **Vercel KV (Upstash Redis):** sessions, portfolio, watchlist, alerts, people index, ontology
- **localStorage:** map layer prefs, cached positions, demo finance data

## Native Apps

- iOS + macOS share `EpiphanyAPI` client class (cookie session, 2min cache)
- Backend base URL: `https://monica.heyitsmejosh.com`
- All data loaded in parallel on launch via `AppState.loadAll()`
