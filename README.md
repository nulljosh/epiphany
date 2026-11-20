<img src="icon.svg" width="80" style="border-radius:18px">

[![web](https://img.shields.io/badge/web-v6.10.0-blue)](https://epiphany.jaybulb.com) [![ios](https://img.shields.io/badge/iOS-v6.10.0-blue)](https://apps.apple.com/app/epiphany/id6779522175) [![license](https://img.shields.io/badge/license-Apache%202.0-green)](LICENSE)

Your world on one screen: the map, the markets and your money.

<p align="center">
  <img src="public/screenshots/screenshot-situation-new.png" width="170">
  <img src="public/screenshots/screenshot-markets-new.png" width="170">
  <img src="public/screenshots/screenshot-stocks-new.png" width="170">
  <img src="public/screenshots/screenshot-portfolio-new.png" width="170">
</p>

- **Map:** flights, weather, news and incidents around you, live.
- **Markets:** stocks, crypto and commodities with full-screen charts and alerts.
- **Portfolio:** your brokerage synced read only, net worth and spending.
- **Autopilot:** the trading rule on paper money, scored against the S&P 500 ([whitepaper](WHITEPAPER.md)).

Web, iPhone, Mac and Apple Watch. Free, Pro from $1.99 a month.

## Run

```bash
npm install && npm run dev
npm test -- --run
npm run build && npx wrangler deploy
```

Docs are in [docs/](docs/), open work in [roadmap.md](roadmap.md). Apache 2.0, Joshua Trommel.
