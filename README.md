<img src="icon.svg" width="80">

# Monica.
![version](https://img.shields.io/badge/version-v3.4.0-blue)

Personal intelligence platform. Map, markets, and people -- Palantir for regular people.

[Live](https://monica.heyitsmejosh.com) -- [Architecture](architecture.svg)

## Features

- **Map** -- MapLibre GL, geolocation, dark/light tiles, city hubs, heat map overlay
- **Data layers** -- Flights, traffic, earthquakes, weather alerts (NOAA + Environment Canada), crime, local events, wildfires (NASA FIRMS), GDELT news, Polymarket
- **AI analyst** -- Claude-powered intelligence chat with 10 tool functions (stock lookup, portfolio, news, macro, ontology, alerts, watchlist, create alerts, add notes)
- **Personal ontology** -- Knowledge graph with 9 object types, 6 relationship types, batch upsert, query engine
- **Command bar** -- Cmd+K universal search across stocks, cities, markets, people, AI
- **Situation Monitor** -- Detection cards with severity levels, source health indicators, event timeline
- **Trading simulator** -- 167 assets, Kelly sizing, Fibonacci levels, PnL
- **Portfolio** -- Holdings, budgets, debt payoff, spending analysis (PDF upload), income overlays, GST/HST credit tracking
- **Anomaly detection** -- Auto-flags >5% movers, volume spikes, spending outliers
- **Ticker bar** -- Live scrolling prices with anomaly badges
- **Auth + billing** -- bcrypt/KV sessions, Stripe (Free/$20/$50), Apple Pay
- **PWA** -- Offline service worker
- **Companions** -- iOS (SwiftUI), macOS (SwiftUI), watchOS (SwiftUI)

## Run

```bash
npm install
npm run dev
npm test -- --run
npm run build
```

Deploy: Vercel. Repo: github.com/nulljosh/monica

## Roadmap

### Ongoing
- [ ] Phase 3: Data Fusion Engine (cross-source correlation)
- [ ] Phase 4: Automated Workflows + Decision Support
- [ ] Phase 5: Timeline + Graph Visualization
- [ ] Phase 6: Semantic Search

## Changelog

### v3.3.0 (2026-03-27)
- Savings forecast: Monte Carlo + Holt-Winters projections from bank statements, rendered as amber overlay on spending chart
- Daily market brief (top gainers/losers + headlines, 1h cache)
- Wildfire map layer (NASA FIRMS VIIRS satellite data)
- Incident radius doubled (0.15 -> 0.3 degrees, fallback 0.5 -> 1.0), added railway=construction for SkyTrain
- 5 new macro indicators: unemployment, jobless claims, consumer confidence, PCE inflation, retail sales
- English language filter for news (stop-word heuristic)
- iOS: camera option for profile photo, fix 1D chart cancellation error
- macOS: portfolio summary with net worth + account chips, daily brief, market filter segments, wildfire map layer
- Fix portfolio showing account balances (TFSA, vacation) in unreachable branch

### v3.2.0 (2026-03-27)
- AI intelligence analyst (Claude-powered streaming chat with tool calling)
- 12 iOS bug fixes: fire hydrants on map, laggy tabs, stuck portfolio spinner, profile photo persistence, people search (Wikipedia fallback), map sources page, TradingView-style rows, market filter segments, Tally visibility, parallel data preloading
- Propagated fixes to macOS
- Review cleanup: parallelized AI tool execution and KV reads, fixed broken stock lookup, structured history persistence

### v3.1.0 (2026-03-27)
- Personal Ontology Layer: 9 object types, 6 relationship types, CRUD API, batch upsert, query engine
- Auto-population from existing data sources (stocks -> Assets, earthquakes -> Events)
- Client hooks with optimistic updates
- iOS/macOS/watchOS ontology models with AnyCodable array support

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
