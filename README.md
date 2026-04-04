<img src="icon.svg" width="80">

# Monica.
![version](https://img.shields.io/badge/version-v4.1.0-blue)

Personal intelligence platform. Map, markets, and people -- Palantir for regular people.

[Live](https://monica.heyitsmejosh.com) -- [Architecture](architecture.svg)

## Features

- **Live Map** -- MapLibre GL with 11 data layers: flights, traffic, earthquakes, weather alerts, crime, local events, wildfires, news, incidents, predictions, heatmap
- **AI Analyst** -- Claude-powered streaming chat with 10 tool functions
- **Markets** -- Live stock data, ticker bar, anomaly detection, trading simulator
- **Portfolio** -- Holdings, budgets, debt payoff, spending analysis, income overlays
- **People** -- Search + index with AI enrichment, relationship graph, news cross-referencing
- **Prediction Markets** -- Polymarket integration with whale tracking
- **Personal Ontology** -- Knowledge graph with 9 object types, 6 relationship types
- **Command Bar** -- Cmd+K universal search across stocks, cities, markets, people
- **Situation Monitor** -- Detection cards with severity levels, source health, event timeline
- **Auth + Billing** -- bcrypt/KV sessions, Stripe subscriptions, Apple Pay
- **PWA** -- Offline service worker
- **Companions** -- iOS, macOS, watchOS (SwiftUI)

## Run

```bash
npm install
npm run dev
npm test -- --run
npm run build
```

Deploy: Vercel. Repo: github.com/nulljosh/monica

## License

MIT 2026, Joshua Trommel
