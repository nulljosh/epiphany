<img src="icon.svg" width="80">

# Monica.
![version](https://img.shields.io/badge/version-v5.0.0-blue)

Personal intelligence platform. Map, markets, and people. Palantir for regular people.

[Live](https://monica.heyitsmejosh.com) | [Architecture](architecture.svg) | [Whitepaper](whitepaper.md)

## Features

- **Live Map** with 11 data layers (flights, traffic, earthquakes, weather, crime, events, wildfires, news, incidents, predictions, heatmap)
- **AI Analyst** powered by Claude with streaming chat and 10 tool functions
- **Markets** with live stock data, ticker bar, anomaly detection, trading simulator
- **Portfolio** tracking holdings, budgets, debt payoff, and spending analysis
- **People** search and index with AI enrichment, relationship graph, news mentions
- **Prediction Markets** via Polymarket with whale tracking
- **Knowledge Graph** with 9 object types and 6 relationship types
- **Command Bar** (Cmd+K) for universal search
- **Situation Monitor** with severity cards, source health, event timeline
- **Auth + Billing** with Free and Premium ($1/wk) tiers
- **PWA** with offline service worker
- **Companions** for iOS, macOS, and watchOS

## Run

```bash
npm install
npm run dev
npm test -- --run
npm run build
```

Deploy: Vercel

## License

Apache 2.0, 2026, Joshua Trommel
