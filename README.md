<img src="icon.svg" width="80" style="border-radius:18px">

# Epiphany.
![web](https://img.shields.io/badge/web-v2.6.0-blue) ![ios](https://img.shields.io/badge/iOS-v2.5.2-blue) ![macos](https://img.shields.io/badge/macOS-v2.2.4-blue) ![watchos](https://img.shields.io/badge/watchOS-v1.0.0-blue) [![appstore](https://img.shields.io/badge/App%20Store-live-success)](https://apps.apple.com/app/epiphany/id6779522175) ![license](https://img.shields.io/badge/license-Apache%202.0-green) [![GitHub](https://img.shields.io/badge/GitHub-nulljosh%2Fepiphany-black?logo=github)](https://github.com/nulljosh/epiphany)

Personal intelligence platform. Map, markets, and people. Palantir for regular people.

[Live](https://epiphany.heyitsmejosh.com) | [App Store](https://apps.apple.com/app/epiphany/id6779522175) | [Architecture](architecture.svg) | [Whitepaper](WHITEPAPER.md)

<p align="center">
  <img src="public/screenshots/screenshot-situation-new.png" width="180">
  <img src="public/screenshots/screenshot-markets-new.png" width="180">
  <img src="public/screenshots/screenshot-stocks-new.png" width="180">
</p>

<p align="center">
  <img src="macos/fastlane/screenshots/mac/1-main.png" width="320">
  <img src="watchos/fastlane/screenshots/watch/1-main.png" width="120">
</p>

## Tabs

| Tab | Status |
|---|---|
| Situation | Live map + daily brief + situation monitor + macro pulse |
| Markets | Stocks, crypto, commodities, fear/greed, Polymarket whales |
| Simulator | 60fps trading simulator with Kelly criterion and edge detection |
| Portfolio | Holdings, budgets, debt payoff, spending analysis |
| People | Search and index with relationship graph |
| Settings | Theme, ticker, account, billing |

## Features

- **Live Map** — 11 live data layers: flights, earthquakes, weather, wildfires, news, incidents, emergency services, dispatch, crime, local events, predictions
- **Daily Brief** — morning summary on Situation tab with top movers + headlines
- **Macro Pulse** — live strip: GDP, CPI, fed rate, yields, VIX, fear/greed
- **Markets** — live stock data, bid/ask/exchange detail, 1m/15m/max timeframes, anomaly detection
- **Indicators + Signal** — RSI, MACD, Bollinger Bands, SMAs, Stochastic, ATR, Buy/Hold/Sell badge
- **Trading Simulator** — 60fps canvas with Kelly criterion and edge detection
- **Portfolio** — holdings, debt payoff projections, spending analysis
- **Prediction Markets** — Polymarket with whale tracking
- **Knowledge Graph** — 9 object types, 6 relationship types
- **Command Bar** — Cmd+K universal search
- **Auth + Billing** — Free and Premium ($1/wk via Stripe)
- **Landing Page** — animated node-graph hero, scrolling ticker, feature/pricing sections
- **PWA** — offline service worker
- **Native** — iOS, macOS, watchOS companions

## This Week / This Month

**This week**
- [x] Fix SnapTrade phantom holdings + bad math (dedupe accounts by id, 2026-07-02)
- [ ] Watch v2.5.1 (build 6) clear App Store review

**This month**
- [ ] Statement upload UI bug — button not persisting file
- [ ] News-not-loading investigation
- [ ] Mac/watchOS App Store submission checklist items (compliance answers, support URL)

## Weekend Roadmap

- [ ] Watch first live Autopilot BTC probe fill (capped at 3 fractional trades, auto-reverts to paper)
- [ ] Per-stock news drawer on `StockDetailView` (same drag pattern as Markets, scoped to that stock's news)
- [ ] News-not-loading investigation (`fetchNews()` / backend news endpoint)
- [ ] Statement upload UI bug — button doesn't persist the file (manual KV workaround used once, root cause still open)
- [ ] Mom/dad debt amounts — update to $300/$350/$200 in Budget editor
- [ ] App Store submission checklist (screenshots, privacy questionnaire, demo account, build green)

See [ROADMAP.md](ROADMAP.md) for the full backlog.

## Setup

See [CLAUDE.md](CLAUDE.md) for dev, test, and build commands.

Deploy: Vercel (`npx vercel --prod`)

## Known issues / next session
- macOS + watchOS screenshot automation confirmed working (fastlane `mac_screenshots` lane, real app UI captured).

## License

MIT 2026, Joshua Trommel

## Autopilot — broker decision (2026-07-02)

Wealthsimple has NO trading API (read-only via SnapTrade, by WS policy — not fixable). Alpaca is US-only for live. Decision:
1. **IBKR Canada** = the stocks path. Josh: open account (~1 day approval), connect via existing SnapTrade flow with trade permission, impact-test should pass, autopilot engine already built.
2. Wealthsimple stays connected read-only for portfolio sync.
3. Kraken (crypto micro-trades) = optional, account created but parked — Josh doesn't want it for now.
4. US customers already get full autopilot via SnapTrade trade-enabled brokers — Canada is the restrictive market, not the product.

## Autopilot via Alpaca (superseded — US-only for live; paper still usable for testing)

SnapTrade/Wealthsimple is **read-only by design** (403 code 1020) — it can never place orders; it stays connected for portfolio sync only. Trade execution runs on Alpaca (already wired: `server/api/broker/{alpaca,signal,positions,webhook,morning-run}.js`, defaults to paper mode).

Remaining manual steps:
1. Josh: sign up at alpaca.markets (free), dashboard → Generate API Keys (paper).
2. Add `ALPACA_API_KEY` + `ALPACA_API_SECRET` to Vercel production, redeploy.
3. Verify `/api/broker/positions` returns account JSON, place one paper order via signal endpoint.
4. Later: switch `ALPACA_BASE_URL` to live once paper autopilot proves out.
