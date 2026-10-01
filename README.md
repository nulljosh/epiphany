<img src="icon.svg" width="80" style="border-radius:18px">

# Epiphany

Everything happening in your world, on one screen. The map, the markets, the people.

[Live](https://epiphany.heyitsmejosh.com) | [App Store](https://apps.apple.com/app/epiphany/id6779522175) | [Whitepaper](WHITEPAPER.md) | [Roadmap](roadmap.md)

<p align="center">
  <img src="docs/double7s-spy.gif" width="720" alt="The Epiphany trading algorithm replaying SPY day by day: green arrows buy, red arrows sell">
  <br>
  <sub>The trading algorithm replaying the S&amp;P 500 ETF, one day at a time. Green arrows buy, red arrows sell.</sub>
</p>

<p align="center">
  <img src="public/screenshots/screenshot-situation-new.png" width="170">
  <img src="public/screenshots/screenshot-markets-new.png" width="170">
  <img src="public/screenshots/screenshot-stocks-new.png" width="170">
  <img src="public/screenshots/screenshot-portfolio-new.png" width="170">
</p>

## What it does

- **Situation.** A live map with 11 layers (flights, weather, news, incidents and more), a daily brief, and the macro pulse.
- **Markets.** Stocks, crypto and commodities with a Buy, Hold or Sell read on each. Prediction markets too.
- **Portfolio.** Holdings, net worth and where the money went. Read-only brokerage sync.
- **People.** Search anyone and see how they connect.
- **Autopilot.** Our trading algorithm, on paper money.

Web, iOS, macOS, watchOS, Windows, Linux and Android. Free to start, $1 once for everything.

## Does the trading work?

We replayed it on real history: hundreds of stocks, index funds, Bitcoin, gold, oil, and the S&P 500 back to 1927. Each strategy was tuned on older years, then graded on years it had never seen. Fees included.

One rule passed: **Double 7s.** In a rising market, buy a 10 day low and sell a 10 day high.

| Tested on | Trades that made money | Average gain per trade | Trades |
|---|---|---|---|
| 429 S&P 500 stocks | 67% | 0.39% | 22,614 |
| 16 index funds | 71% | 0.44% | 807 |
| Our watchlist, each symbol from its first day | 69% | 0.62% | 3,508 |
| Bitcoin | 71% | | 104 |
| S&P 500 index, 49 unseen years (a related dip rule) | 77% | | 377 |

**It does not beat buying and holding.** Run as one account it grew about 3% a year against 15% for SPY. Even parking idle cash in SPY only reached 8.8%. Most of the wins are just the market rising. The full story, failures included, is in [WHITEPAPER.md](WHITEPAPER.md#5-benchmark-does-it-work).

Run it yourself: `python3 tradingview/backtest.py sp500`. Daily paper trading through Interactive Brokers: `scripts/ibkr-run.py`.

## Run it

```bash
npm install && npm run dev
npm test -- --run
npm run build
```

Deploys to Cloudflare Workers (`npm run deploy`). Dev notes are in [CLAUDE.md](CLAUDE.md). `npm run tui -- <email>` is a live portfolio dashboard in the terminal.

For Claude Code: [`.claude/skills/epiphany`](.claude/skills/epiphany/SKILL.md) reads and edits portfolio data directly, and [`docs/API.md`](docs/API.md) lists the HTTP and agent tools.

## Credits

Chart control is built on [tradingview-mcp](https://github.com/tradesdontlie/tradingview-mcp) by tradesdontlie (MIT). Full notice in [THIRD_PARTY.md](THIRD_PARTY.md).

## License

Apache 2.0, 2026, Joshua Trommel
