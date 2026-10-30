<img src="icon.svg" width="80" style="border-radius:18px">

[![web](https://img.shields.io/badge/web-v41.0.0-blue)](https://epiphany.jaybulb.com) [![ios](https://img.shields.io/badge/iOS-v41.0.0-blue)](https://apps.apple.com/app/epiphany/id6779522175) [![macos](https://img.shields.io/badge/macOS-v41.0.0-blue)](https://apps.apple.com/app/epiphany/id6779522175) [![license](https://img.shields.io/badge/license-Apache%202.0-green)](LICENSE)

Everything happening in your world, on one screen. The map, the markets, the people.

[Live](https://epiphany.jaybulb.com) | [App Store](https://apps.apple.com/app/epiphany/id6779522175) | [Whitepaper](WHITEPAPER.md)

<p align="center">
  <img src="public/screenshots/screenshot-situation-new.png" width="170">
  <img src="public/screenshots/screenshot-markets-new.png" width="170">
  <img src="public/screenshots/screenshot-stocks-new.png" width="170">
  <img src="public/screenshots/screenshot-portfolio-new.png" width="170">
</p>

## Features

- **Situation.** A live map of flights, weather, news and incidents, plus a daily brief.
- **Markets.** Stocks, crypto and commodities, each with a Buy, Hold or Sell read. Index cards, top movers, full-screen charts and price alerts.
- **Portfolio.** Holdings, net worth and where the money went.
- **People.** Search anyone and see how they connect.
- **Autopilot.** The trading algorithm, on paper money, scored against the S&P 500.

Web, iPhone, iPad, Mac and Apple Watch. Free to start, $1 once for everything.

## Does the trading work?

One rule survived years of data it had never seen: **Double 7s.** In a rising market, buy a 10 day low and sell a 10 day high. About 70% of its trades make money, across 429 stocks, 16 index funds and Bitcoin.

It still does not beat buying and holding. Run as one account it grew about 3% a year against 15% for SPY. The full test, failures included, is in the [whitepaper](WHITEPAPER.md#5-benchmark-does-it-work).

<p align="center">
  <img src="docs/double7s-spy.gif" width="720" alt="The trading algorithm replaying SPY day by day: green arrows buy, red arrows sell">
</p>

## Run it

```bash
npm install && npm run dev
npm test -- --run
npm run build && npx wrangler deploy
```

Docs live in [docs/](docs/). Chart control builds on [tradingview-mcp](https://github.com/tradesdontlie/tradingview-mcp) (MIT), see [THIRD_PARTY.md](THIRD_PARTY.md).

## License

Apache 2.0, 2026, Joshua Trommel
