<img src="icon.svg" width="80">

![version](https://img.shields.io/badge/version-v49.0.0-blue)

Epiphany for Mac. The map, the markets and your money, laid out for a big screen.

## Features

- **Situation.** The live map with every layer, venue search and Look Around.
- **Markets.** The list sits in a column and the stock you pick opens beside it, with a chart you can scrub and grow. Index cards, top movers and Fear & Greed when nothing is picked.
- **People.** Search anyone and see how they connect.
- **Portfolio.** Spending, holdings, budget and statements.
- **Menu bar.** Your watchlist one click away, and price alerts in Notification Center.
- Light and dark, a Liquid Glass bar, Cmd-1 to Cmd-5.

## Run

```bash
xcodegen generate
xcodebuild -project Epiphany.xcodeproj -scheme Epiphany -destination 'platform=macOS' build
```

Agent notes are in [CLAUDE.md](CLAUDE.md). Open work is in the repo's [roadmap](../roadmap.md).
