<img src="icon.svg" width="80" style="border-radius:18px">

# Epiphany.
[![web](https://img.shields.io/badge/web-v2.6.2-blue)](https://epiphany.heyitsmejosh.com) [![ios](https://img.shields.io/badge/iOS-v2.5.5-blue)](https://apps.apple.com/app/epiphany/id6779522175) [![macos](https://img.shields.io/badge/macOS-v2.5.2-blue)](https://apps.apple.com/app/epiphany/id6779522175) [![watchos](https://img.shields.io/badge/watchOS-v1.0.0-blue)](https://apps.apple.com/app/epiphany/id6779522175) [![appstore](https://img.shields.io/badge/App%20Store-live-success)](https://apps.apple.com/app/epiphany/id6779522175) [![license](https://img.shields.io/badge/license-MIT-green)](LICENSE) [![GitHub](https://img.shields.io/badge/GitHub-nulljosh%2Fepiphany-black?logo=github)](https://github.com/nulljosh/epiphany) [![Claude Skill](https://img.shields.io/badge/Claude%20Skill-epiphany-CC785C?logo=claude)](.claude/skills/epiphany/SKILL.md)

Everything happening in your world, on one screen. The map, the markets, the people. Palantir for regular people.

[Live](https://epiphany.heyitsmejosh.com) | [App Store](https://apps.apple.com/app/epiphany/id6779522175) | [Architecture](architecture.svg) | [Whitepaper](WHITEPAPER.md)

<p align="center">
  <img src="public/screenshots/screenshot-situation-new.png" width="180">
  <img src="public/screenshots/screenshot-markets-new.png" width="180">
  <img src="public/screenshots/screenshot-stocks-new.png" width="180">
  <img src="public/screenshots/screenshot-portfolio-new.png" width="180">
</p>

<p align="center">
  <img src="macos/fastlane/screenshots/mac/1-main.png" width="320">
  <img src="watchos/fastlane/screenshots/watch/1-main.png" width="120">
</p>

## Claude Skill

[`.claude/skills/epiphany`](.claude/skills/epiphany/SKILL.md) gives Claude Code admin access to your portfolio data in Upstash KV. Holdings, debt, budget. No app login:

```bash
scripts/kv-portfolio-edit.sh get <email>            # dump current portfolio JSON
scripts/kv-portfolio-edit.sh set <email> <file.json> # overwrite with merged JSON
```

## Tabs

| Tab | Status |
|---|---|
| Situation | Live map + daily brief + situation monitor + macro pulse |
| Markets | Stocks, crypto, commodities, fear/greed, Polymarket whales |
| Simulator | 60fps trading simulator with Kelly criterion and edge detection |
| Portfolio | Holdings, budgets, spending analysis |
| People | Search and index with relationship graph |
| Settings | Theme, ticker, account, billing |

## Features

- **Live Map.** 11 layers: flights, earthquakes, weather, wildfires, news, incidents, emergency services, dispatch, crime, local events, predictions
- **Daily Brief.** The morning in one card: top movers and headlines
- **Macro Pulse.** GDP, CPI, the Fed rate, yields, VIX, fear and greed, live
- **Markets.** Live quotes with bid, ask and exchange. 1m, 15m and max. Anomalies flagged
- **Indicators and Signal.** RSI, MACD, Bollinger, SMAs, Stochastic, ATR, and one Buy, Hold or Sell badge
- **Trading Simulator.** A 60 fps canvas with Kelly sizing and edge detection
- **Portfolio.** Holdings, net worth, where the money went
- **Prediction Markets.** Polymarket, with the whales tracked
- **Knowledge Graph.** 9 kinds of thing, 6 kinds of link
- **Command Bar.** Cmd+K, then type
- **Auth and Billing.** Free, or Premium at $1 a week through Stripe
- **Landing Page.** A node-graph hero, a ticker, features and pricing
- **PWA.** Works offline
- **Native.** iOS, macOS and watchOS

Roadmap: [ROADMAP.md](ROADMAP.md).

## Setup

See [CLAUDE.md](CLAUDE.md) for dev, test, and build commands.

### Terminal dashboard

`npm run tui -- <email>` is a live portfolio dashboard in the terminal (ink). It reads Upstash KV directly. No login.

Deploy: Vercel (`npx vercel --prod`)

## License

Apache 2.0, 2026, Joshua Trommel

## API and agent tools

An agent can drive this app. [`docs/API.md`](docs/API.md) lists the HTTP surface, where there
is one, and the WebMCP tools registered on `document.modelContext`. Tools come in three kinds:
read-only, writes you can undo, and the few that ask a human first.
