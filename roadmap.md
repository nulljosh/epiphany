# Roadmap

Open work only, grouped by area. Finished work, the Mobbin passes and the old ingest logs are in
[docs/reference/roadmap-history.md](docs/reference/roadmap-history.md). Versions follow CLAUDE.md: a feature is a minor, a fix is a patch.

## Needs Joshua (an account, a key or a decision)
- [ ] **Trading:** IBKR Canada login lost (application started 2026-09-06, approval never recorded). Recover it, then write `server/api/broker/ibkr.js` like `alpaca.js` and swap it into `morning-run.js:runLive()`. Alpaca rejects Canadians; SnapTrade and Wealthsimple stay read only.
- [ ] **Live autopilot caps:** live mode caps a trade at $50 but SSO is about $70 and BIL about $91, so Trend 2x buys nothing. Size by `allocation` % of balance, then rerun `impact-test` (local CRON_SECRET is stale).
- [ ] **App Store:** 6.3.3 submission issue from 2026-11-14 (submission da46c543-01ad-4d4b-8f4c-eae5eaac5d96); read it with `asc`. Then ship 6.5.x from the upstairs Mac (iOS stock view, news spinner).
- [ ] **App icon:** the lyre is the last of the god theme, and Co-Stanza uses the same harp. Pick a new mark (`/icon`).
- [ ] **Keys:** Brave Search or Google CSE (People finds only Wikipedia names), FRED (macro series), a new Yelp key (Fusion went paid).
- [ ] **SnapTrade:** confirm billing in the dashboard; manual refreshes may be billed per call (sync asks at most every 3 hours per user).
- [ ] **Statements:** re-upload June 2026 and upload April 2026 from the Wealthsimple Cash account.
- [ ] **Sign in on iOS** with Google or Facebook: the server is done, the client needs the provider apps configured.
- [ ] **Predictions** (Polymarket, Kalshi, Wealthsimple Predict): integrate or build?
- [ ] **Landing light mode** conflicts with the "web is dark only" rule: retire the rule or drop the item.
- [ ] **Stale App Store links** (P1): every link in code points at id6779522175. Which page has an old one?
- [ ] **Promo video** like the Joshua Tree one, for the README and landing: which video is the model?

## Portfolio and money
- [ ] Pilots: famous-investor portfolios from public 13F filings and congress trades, read only, with performance against yours and new-trade alerts. Web first.
- [ ] Sync statements from Wealthsimple instead of uploading PDFs.
- [ ] Teach the statement parser the TFSA statement (contributions, withdrawals, buys, sells).
- [ ] Verify an iOS statement upload with a real PDF.
- [ ] "N to review" transaction queue (Copilot, Monarch; #179).
- [ ] Spending flow (Sankey) from income to categories.
- [ ] From the daily snapshots: net worth over time, rate of return with a custom range, against the S&P 500 over 1M/3M/YTD, a monthly returns grid, hit rate. They wait on weeks of snapshots.
- [ ] Gain chart toggles (value, invested, cost basis): needs a value history.

## Markets and stocks
- [ ] Stocks view: default to Live, tidy the 1m to All range buttons.
- [ ] Ticker bar: iOS scroll physics; a scroll should not open a stock.
- [ ] Push notifications with the phone locked: price alerts, severe weather nearby, M4+ quakes, wildfires, bill reminders.
- [ ] Earnings results alert for stocks you follow (reuse the alerts email).
- [ ] "N recent updates" on a stock page: news since you last opened it.
- [ ] Markets chips: Now, Macro, Crypto.
- [ ] Chart metric tabs (price, market cap, P/E): needs EPS and share count history.
- [ ] Menu bar P&L second by second: needs IB's streaming P&L feed.
- [ ] Untangle `ASSETS` in `src/App.jsx` and the watchlist from the 978-line trading simulator (own session).
- [ ] Move the other WHITEPAPER benchmark tables into results.json when each is rerun.

## Map
- [ ] Incidents like a local gas line fire: find a feed that carries them.
- [ ] Incident status on pins (active or resolved): needs a status field in the feeds.
- [ ] Filter bar by incident type and time; saved places with incident counts.
- [ ] Plane animation is choppy; make it smooth.
- [ ] Place sheet: what else to show beyond hours, phone, website, address and directions.
- [ ] Map overlay UI from the design kit, with the settings moved into Settings.

## Apps and settings
- [ ] Appearance at the bottom of Settings.
- [ ] Mac app: a full end-to-end test pass.
- [ ] Refresh screenshots (App Store via fastlane UITEST_DEMO, README, landing) once the icon lands.
