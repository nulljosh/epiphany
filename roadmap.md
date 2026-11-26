# Roadmap

Open work only, grouped by area. Finished work, the Mobbin passes and the old ingest logs are in
[docs/reference/roadmap-history.md](docs/reference/roadmap-history.md). Versions follow CLAUDE.md: a feature is a minor, a fix is a patch.

## Needs Joshua (an account, a key or a decision)
- [ ] **Free app + Stripe Pro in app** (Joshua, 2026-11-25): Apple allows a Stripe link-out only on the US storefront; elsewhere Pro needs a StoreKit subscription (no subscription group exists in ASC yet). 6.11.0 adds a Get Pro link to Stripe on the US storefront (iPhone and Mac Settings, lands on /?pro=1). Next: ship 6.11 when the week gate opens (2026-11-29), and once it is approved set the price to $0 and EPIPHANY_FREE_SINCE. Other storefronts show no purchase button until a StoreKit subscription exists.
- [ ] **Trading:** IBKR Canada login lost (application started 2026-09-06, approval never recorded). Recover it, then write `server/api/broker/ibkr.js` like `alpaca.js` and swap it into `morning-run.js:runLive()`. Alpaca rejects Canadians; SnapTrade and Wealthsimple stay read only.
- [ ] **Live autopilot caps:** live mode caps a trade at $50 but SSO is about $70 and BIL about $91, so Trend 2x buys nothing. Size by `allocation` % of balance, then rerun `impact-test` (local CRON_SECRET is stale).
- [ ] **App Store:** 6.11.0 submitted for iOS and Mac on 2026-11-25 (build 202611251954, Joshua's yes past the week gate). When approved: price to $0 and set EPIPHANY_FREE_SINCE.
- [ ] **App icon:** the lyre is the last of the god theme, and Co-Stanza uses the same harp. Pick a new mark (`/icon`).
- [ ] **Keys:** Brave Search or Google CSE (People finds only Wikipedia names), FRED (macro series), a new Yelp key (Fusion went paid).
- [ ] **SnapTrade:** confirm billing in the dashboard; manual refreshes may be billed per call (sync asks at most every 3 hours per user).
- [ ] **Statements:** re-upload June 2026 and upload April 2026 from the Wealthsimple Cash account.
- [ ] **Sign in on iOS** with Google or Facebook: the server is done, the client needs the provider apps configured.
- [ ] **Predictions** (Polymarket, Kalshi, Wealthsimple Predict): integrate or build?
- [ ] **Landing light mode** conflicts with the "web is dark only" rule: retire the rule or drop the item.
- [ ] **Stale App Store links** (P1): every link in code points at id6779522175. Which page has an old one?
- [ ] **Promo video** like the Joshua Tree one, for the README and landing: which video is the model?
- [ ] **Main feature:** Markets or the map? (notes 2026-11-23; screenshots `notes/attachments/2026-11-23/22738-*.png` not yet read)

## Portfolio and money
- [ ] Pilots, next: congress trades, new-filing alerts, and iOS/Mac (web v1 shipped 6.7.0: six investors' top 10 from their latest 13F, return since the quarter ended against the S&P 500, holdings you share).
- [ ] Sync statements from Wealthsimple instead of uploading PDFs.
- [ ] Teach the statement parser the TFSA statement (contributions, withdrawals, buys, sells).
- [ ] Verify an iOS statement upload with a real PDF.
- [ ] "N to review" transaction queue (Copilot, Monarch; #179).
- [ ] Spending flow (Sankey) from income to categories.
- [ ] From the daily snapshots: net worth over time, rate of return with a custom range, against the S&P 500 over 1M/3M/YTD, a monthly returns grid, hit rate. They wait on weeks of snapshots.
- [ ] Gain chart toggles (value, invested, cost basis): needs a value history.

## Markets and stocks
- [ ] Ticker bar: iOS scroll physics; a scroll should not open a stock. Slower, tappable, Wall Street tape look (dotted font).
- [ ] Mac Markets: drop the portfolio section (it lives in Portfolio); Liquid Glass and a Mobbin pass on the Mac markets UI.
- [ ] Push notifications with the phone locked: price alerts, severe weather nearby, M4+ quakes, wildfires, bill reminders.
- [ ] Earnings results alert for stocks you follow (reuse the alerts email).
- [ ] "N recent updates" on a stock page: news since you last opened it.
- [ ] Markets chips: Now, Macro, Crypto.
- [ ] Chart metric tabs (price, market cap, P/E): needs EPS and share count history.
- [ ] Menu bar P&L second by second: needs IB's streaming P&L feed.
- [ ] Untangle `ASSETS` in `src/App.jsx` and the watchlist from the 978-line trading simulator (own session).
- [ ] Move the other WHITEPAPER benchmark tables into results.json when each is rerun.

## Mobbin: stock view (2026-11-20: Robinhood, TradingView, Yahoo Finance, Apple Stocks, Webull, Public, Stock Events, moomoo)
| Gap | Apps | Size | Status |
|---|---|---|---|
| Drag the chart and the header price, change and date follow the finger | Robinhood, Apple Stocks, Public, Webull | S |done 6.10.0 |
| Change line matches the range: "+$X (Y%) past year", not always today | Public, Robinhood | S |done 6.10.0 |
| Previous close as a dotted line on intraday charts; market status line (open, at close, after hours) | Apple Stocks, Yahoo, TradingView | S | open |
| Who holds it: Pilots investors that own the stock, with their weight | moomoo (13F insights) | S | open |
| Sections as tabs (Overview, News, About) instead of one long scroll | TradingView, moomoo, Yahoo | M | open |

## Map
- [ ] Incidents like a local gas line fire: find a feed that carries them.
- [ ] Incident status on pins (active or resolved): needs a status field in the feeds.
- [ ] Filter bar by incident type and time; saved places with incident counts.
- [ ] Plane animation is choppy; make it smooth.
- [ ] Place sheet: what else to show beyond hours, phone, website, address and directions.
- [ ] Map overlay UI from the design kit, with the settings moved into Settings.
- [ ] Mac map: a go-to-my-location button like iOS; search bar in the app font and bigger; filters at the top by search, not the bottom; event sheets close on a click outside, not only Escape; a better map sources panel.
- [ ] Mac 6.3.3 QA (2026-11-25): filter chips sit on the Apple Maps logo and Legal link; the selected tab label is blue on blue, hard to read.
- [ ] Places of interest: one tap to the busiest cities (Tokyo, New York, Los Angeles, London, Paris, Milan, Hong Kong).

## Apps and settings
- [ ] Mac app: a full end-to-end test pass. Confirm Pro checkout works and shows the right price.
- [ ] Mac Settings: Appearance at the bottom (iOS done 6.8.0); profile block spacing, it sits all to the right.
- [ ] People: better examples than Taylor Swift, and a real photo per person instead of the default icon.
- [ ] Refresh screenshots (App Store via fastlane UITEST_DEMO, README, landing) once the icon lands.
