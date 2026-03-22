<img src="icon.svg" width="80">

# Opticon
![version](https://img.shields.io/badge/version-v2.6.0-blue)

Live map and market app. Prices, news, and local activity on one screen.

[Live](https://opticon.heyitsmejosh.com) -- [Architecture](architecture.svg)

## Features

- **Map** -- MapLibre GL, geolocation, dark/light tiles, city hubs
- **Data layers** -- Flights, traffic, earthquakes, weather, GDELT news, Polymarket
- **Trading simulator** -- 167 assets, Kelly sizing, Fibonacci levels, PnL
- **Portfolio** -- Holdings, budgets, debt payoff, spending analysis (PDF upload), income overlays
- **Ticker bar** -- Live scrolling prices
- **Auth + billing** -- bcrypt/KV sessions, Stripe (Free/$20/$50), Apple Pay
- **PWA** -- Offline service worker
- **Companions** -- opticon-ios, opticon-macos

## Run

```bash
npm install
npm run dev
npm test -- --run
npm run build
```

Deploy: Vercel (Cloudflare migration planned for API).

## Roadmap

- [ ] Cloudflare API migration
- [ ] Watchlist with alerts
- [ ] Multi-account portfolio aggregation
- [ ] Historical spending trends
- [ ] macOS companion feature parity

## Changelog

### v2.6.0 (2026-03-21)
- Tally integration: /api/tally endpoint with BC payment schedule fallback
- Macro API: hardcoded fallback data when FRED key is missing (no more 503)

### v2.5.1 (2026-03-21)
- Fix: transaction categorization -- Apple.com/Mac purchases now classify as "tech" instead of uncategorized
- Fix: added Codex to apps category

### v2.5.0 (2026-03-21)
- Incident radius fix (111km -> 16km)
- Restored transactions in statements API

## License

MIT 2026, Joshua Trommel
