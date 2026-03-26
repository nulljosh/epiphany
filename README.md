<img src="icon.svg" width="80">

# Monica.
![version](https://img.shields.io/badge/version-v2.9.0-blue)

Personal intelligence platform. Map, markets, and people -- Palantir for regular people.

[Live](https://monica.heyitsmejosh.com) -- [Architecture](architecture.svg)

## Features

- **Map** -- MapLibre GL, geolocation, dark/light tiles, city hubs, heat map overlay
- **Data layers** -- Flights, traffic, earthquakes, weather, GDELT news, Polymarket
- **Command bar** -- Cmd+K universal search across stocks, cities, markets, people, commands
- **Situation Monitor** -- Detection cards with severity levels, source health indicators, event timeline
- **Trading simulator** -- 167 assets, Kelly sizing, Fibonacci levels, PnL
- **Portfolio** -- Holdings, budgets, debt payoff, spending analysis (PDF upload), income overlays, GST/HST credit tracking
- **Anomaly detection** -- Auto-flags >5% movers, volume spikes, spending outliers
- **Ticker bar** -- Live scrolling prices with anomaly badges
- **Auth + billing** -- bcrypt/KV sessions, Stripe (Free/$20/$50), Apple Pay
- **PWA** -- Offline service worker
- **Companions** -- monica-ios, monica-macos

## Run

```bash
npm install
npm run dev
npm test -- --run
npm run build
```

Deploy: Vercel (Cloudflare migration planned for API).

## Roadmap

### v1.1.0 -- Person Indexer
Third pillar of Monica alongside Map and Markets. Search anyone by name and get an aggregated profile from public sources.

- [ ] Person search tab (Map / Markets / People)
- [ ] Google search aggregation -- scrape and structure results for a given name
- [ ] Social profile discovery -- LinkedIn, Facebook, Twitter/X, Instagram, GitHub
- [ ] Public records integration -- property ownership, court records, business registrations
- [ ] Profile card builder -- photo, bio, links, news mentions, social accounts
- [ ] Local profile cache -- store indexed profiles for instant recall
- [ ] Relationship mapping -- visualize connections between indexed people

### Ongoing
- [ ] Cloudflare API migration
- [ ] Watchlist with alerts
- [ ] Multi-account portfolio aggregation
- [ ] Historical spending trends
- [ ] macOS companion feature parity

## Changelog

### v2.9.0 (2026-03-26)
- Command bar (Cmd+K) -- universal search across stocks, cities, prediction markets, people, commands
- Situation Monitor upgraded to Maven-style detection feed with severity cards (CRITICAL/ELEVATED/MONITOR)
- Source health indicators (flights, traffic, seismic, events freshness)
- Event timeline -- chronological feed merged from all data sources
- Heat map layer on map (toggleable density visualization of all events/incidents)
- Anomaly badges on Ticker and Markets panel for >5% movers
- Macro pulse strip (compact macro indicators)
- Keyboard shortcuts: 1-5 tab switching, Cmd+K command bar

### v2.8.0 (2026-03-26)
- GST/HST credit tracking in portfolio
- iOS visibility improvements (sparkline charts, haptic feedback, Twitter-style news cards)
- PDF feedback: 1D chart fix, native reader, macro spacing, indicators
- Debt payoff shows "now" for single-payment debts

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
