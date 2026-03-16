<img src="icon.svg" width="80">

# Opticon
![version](https://img.shields.io/badge/version-v2.4.0-blue)

Live map and market app. Prices, news, and local activity on one screen.

[Live site](https://opticon.heyitsmejosh.com)

## Architecture

![Architecture](architecture.svg)

## Features

- **Map** -- MapLibre GL with geolocation, dark/light tiles, city hubs
- **Data layers** -- Flights, traffic, earthquakes, weather, GDELT news, Polymarket
- **Trading simulator** -- 167 assets, Kelly sizing, Fibonacci levels, PnL tracking
- **Portfolio** -- Holdings, cash accounts, budget, debt payoff projections, goals, spending analysis with PDF upload, income scenario overlays, stacked category charts, drill-down breakdowns
- **Ticker bar** -- Live scrolling prices
- **Auth** -- bcrypt + KV sessions, Stripe billing (Free/$20/$50), Apple Pay
- **PWA** -- Offline-capable service worker
- **Companions** -- opticon-ios, opticon-macos

## Run

```bash
npm install
npm run dev
npm test -- --run
npm run build
```

## Deploy

Production on Vercel.

## License

MIT 2026, Joshua Trommel
