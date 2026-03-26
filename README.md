<img src="icon.svg" width="80">

# Monica
![version](https://img.shields.io/badge/version-v2.8.0-blue)

Personal intelligence platform. Map, markets, and people -- Palantir for regular people.

[Live](https://opticon.heyitsmejosh.com) -- [Architecture](architecture.svg)

## Features

- **Map** -- MapLibre GL, geolocation, dark/light tiles, city hubs
- **Data layers** -- Flights, traffic, earthquakes, weather, GDELT news, Polymarket
- **Trading simulator** -- 167 assets, Kelly sizing, Fibonacci levels, PnL
- **Portfolio** -- Holdings, budgets, debt payoff, spending analysis (PDF upload), income overlays, GST/HST credit tracking
- **Ticker bar** -- Live scrolling prices
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
