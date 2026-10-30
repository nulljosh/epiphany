> Open work for Epiphany. The Mobbin table sets the order through 10.0; see docs/LOOP-HANDOFF.md.

- [ ] Live autopilot for other users is blocked by its own caps, **needs Joshua**: `morning-run.js` live mode caps each trade at $50 but SSO is about $70 and BIL about $91, so Trend 2x buys zero shares. Paper mode has the same problem at the $1 default cap. Past live attempts failed with SnapTrade 1076 (signature), 1068 (no cash), 1121 (rate limit); local CRON_SECRET is stale so `impact-test` could not be rerun. Size by `allocation` % of balance instead of a flat cap, then run impact-test.

## Mobbin gaps (2026-10-29: Robinhood, Yahoo Finance, TradingView, Copilot, Monarch, Citizen)
One row per minor version, daily-use first. Borrow the idea, never the look.

| Gap | Who has it | Size | Target | Status |
|---|---|---|---|---|
| Price alerts with the app closed | Yahoo, TradingView | M | 8.0 | iOS done 8.0.0; APNs push open in #180 |
| Index cards (S&P 500, Nasdaq, Dow) with mini charts above the list | Robinhood, Yahoo | S | 8.0 | done 8.0.0 (web, iOS, Mac) |
| Top movers row (biggest gainers and losers today) | Robinhood | S | 8.0 | done 8.0.0 (iOS, Mac) |
| Full-screen chart button on stock and asset pages | Yahoo, TradingView | S | 8.0 | done 8.0.0 (web, iOS, Mac) |
| Upcoming bills list from detected recurring charges | Monarch, Copilot, Rocket Money | M | 9.0 | done 9.0.0 (web, iOS, Mac) |
| Cash flow: income vs spending bars by month | Copilot, Monarch | M | 9.0 | done 9.0.0 (web, iOS, Mac) |
| Money insight cards from statements (top merchant, a spending jump) | Copilot | M | 9.0 | done 9.0.0 (web, iOS, Mac) |
| "N to review" transaction queue | Copilot, Monarch | M | 9.0 | #179 |
| Map filter bar: incident type and time window | Citizen | M | 10.0 | done 10.0.0 (web, iOS, Mac) |
| Saved places with nearby-incident counts | Citizen | M | 10.0 | done 10.0.0 (web, iOS, Mac) |
| Multiple named watchlists | Yahoo, TradingView | L | later | done 14.0.0 (web, iOS, Mac) |

## Mobbin pass 2 (20.0, 2026-10-29: Robinhood, Yahoo Finance, Webull, TradingView, Copilot, Monarch, Rocket Money, Delta, Citizen, Stocktwits)
Read from each app's App Store screens. Daily use first, polish before novelty. Skipped: social feeds and sentiment votes, options and futures trading, AI chat, bill negotiation, NFTs, paid tiers.

| Gap | Who has it | Size | Target | Status |
|---|---|---|---|---|
| More alert kinds: 52 week high or low, and earnings day for a followed stock, as toggles | Yahoo | S | 21.0 | done 21.0.0 |
| Budget left per day ("$48 a day for 13 days") on the budget card | Rocket Money | S | 22.0 | done 22.0.0 |
| Live price chip under a headline for each symbol it names | Yahoo | S | 23.0 | done 23.0.0 (iPhone and Mac; the web has no headline list) |
| Review queue: swipe to mark a transaction reviewed, "N to review" badge | Monarch, Copilot | M | 24.0 | done 24.0.0 |
| Bills as a month calendar with the due days marked | Rocket Money | S | 25.0 | done 25.0.0 |
| Allocation donut on the portfolio (stocks, crypto, cash, funds) | Delta, Robinhood | M | 26.0 | done 26.0.0 (no funds bucket: holdings carry no asset type) |
| RSI and MACD in a pane under the price chart, not only in the signal | TradingView, Webull | M | 27.0 | done 27.0.0 (web already had them) |
| Gain chart toggles: value, amount invested, cost basis | Delta | M | 28.0 | parked: needs a value history. `portfolio_history` has an API but nothing writes snapshots; the clear path is a daily cron that values each portfolio server-side in CAD, then the chart reads it |
| Spending flow (Sankey) from income to categories | Monarch | L | 29.0 | open |
| Incident status on map pins: active or resolved | Citizen | S | 29.0 | open, needs a status field in the feeds |
| Weekly earnings digest by email, Sunday, for watched stocks | Yahoo | S | 29.0 | done 29.0.0 (opt-in "Weekly" alert) |

## Mobbin pass 3 (30.0, 2026-10-29: Apple Stocks, Public, Wealthsimple, Empower, Ground News, Waze)

| Gap | Seen in | Size | Version | Status |
|---|---|---|---|---|
| Holdings filter chips: Stocks, ETFs, Crypto, CAD, USD | Wealthsimple | S | 31.0 | done 31.0.0 (no ETF chip until holdings carry an asset type) |
| Goal progress ring on each goal ("85% of goal") | Empower | S | 32.0 | done 32.0.0 |
| Key stats grid under every stock chart (open, high, low, volume, P/E, market cap, 52W high and low, average volume) on all three, same order | Apple Stocks | S | 33.0 | done 33.0.0 (all three had a grid; now one order from `KeyStats.rows`) |
| Estimated yearly dividend income on the portfolio, with a bar per month | Public, Wealthsimple | M | 34.0 | done 34.0.0 (yearly estimate from trailing yield; per-month bars wait on a dividend schedule in the quotes) |
| Chart metric tabs on a stock: Price, Market cap, P/E | Public | M | 35.0 | parked: needs EPS and share count history, or the tabs are the price line rescaled |
| Gas stations near you as a list sorted by distance, under the Gas map chip | Waze | M | 36.0 | done 36.0.0 on web (no prices; the server never tagged fuel, so the chip found nothing). iPhone and Mac have no places list yet |
| Rate of return, annualized and cumulative, with a custom range | Empower | M | 37.0 | waits for a few weeks of daily snapshots (38.0) |
| Daily value snapshot cron (unblocks 28.0 and 37.0) | Delta, Empower | M | 38.0 | done 38.0.0 (21:30 UTC daily, `server/api/portfolio-snapshot.js`) |

Skipped: AI agents and prediction markets (Public), credit card and chequing (Wealthsimple), bias ratings (Ground News, not our news), driver reports and voice packs (Waze, social).

## Mobbin pass 4 (40.0, 2026-10-29: Seeking Alpha, moomoo, YNAB, Quicken Simplifi, BMD Kubera, Morningstar)

| Gap | Seen in | Size | Version | Status |
|---|---|---|---|---|
| Sector heat map on Markets: one tile per sector, coloured by today's move | moomoo, Morningstar | M | 41.0 | done 41.0.0 (web sector map reused; equal weight) |
| Compound growth calculator in Outlook: monthly amount, years, return, with the curve | Kubera, Simplifi | S | 42.0 | done 42.0.0 |
| Total unrealized gain on the portfolio, dollars and percent | Kubera, Morningstar | S | 43.0 | done 43.0.0 (hidden for broker rows without a cost basis) |
| "Left this month" headline: money in minus money out this month, from statements | Simplifi, YNAB | S | 44.0 | done 44.0.0 (newest statement month; says the month by name when statements lag) |
| Projected cash balance for the next 30 days, a line with a Today marker, from cash, bills and income | Simplifi | M | 45.0 | done 45.0.0 (paydays from recurring money in) |
| News topic filter: Markets, Crypto, Earnings, Economy | Seeking Alpha | S | 46.0 | done 46.0.0 (feed has no tags: keyword topics; iPhone and Mac, the web has no headline list) |
| Siri and Shortcuts: "What's my portfolio worth" as an App Intent on iPhone and Mac | YNAB | M | 47.0 | done 47.0.0 (metadata checked in both builds; a spoken Siri run waits on a real device) |
| Move money between budget lines to cover one that went over | YNAB | M | 48.0 | done 48.0.0 (linked lines only, total unchanged) |
| Net worth over time, assets against debts, from the daily snapshots | YNAB | M | later | parked: the first snapshot lands 2026-10-30 21:30 UTC; build once a few weeks exist. 49.0.0 took the web QA leftovers instead |

Skipped: analyst picks and quant grades (Seeking Alpha, paid research), 13F and guru portfolios, options and level 2 (moomoo, trading), shared budgets (YNAB, social), invoices (Simplifi, business), mutual fund buying (Kubera). The apple audit found white text only on solid fills and no teal, purple or indigo; it took three em dashes out of web UI strings.

## Mobbin pass 10 (100.0, 2026-10-30: Flightradar24, Windy, TipRanks, Monefy)

Versions 5.0.0 to 102.0.0 in git history were internal builds, one major per row, which was inflated. They ship together as App Store 5.0.0. From here each row is one minor (5.1, 5.2, ...), see Versioning in `CLAUDE.md`.

| Gap | Seen in | Size | Version | Status |
|---|---|---|---|---|
| Tap a plane for its route, altitude, speed and a progress bar from origin to destination | Flightradar24 | M | 101.0 | done 101.0.0 (adsbdb by callsign) |
| Plane filters: passenger, cargo, military | Flightradar24 | S | 102.0 | done 102.0.0 (callsign prefix plus readsb military flag) |
| Rain radar layer on the map | Windy | M | 5.1 | done 5.1.0 (RainViewer newest frame, free tiles stop at zoom 7; native pins one 512 px image in an Annotation) |
| Severe weather warnings near you on the map | Windy | M | 5.2 | done 5.2.0 (Environment Canada moved to GeoMet, its RSS feeds 404; areas shaded by risk colour) |
| Storm tracks on the map during hurricane season | Windy | M | 5.3 | open, NHC feeds |
| Insider buys and sells on a stock page | TipRanks | M | 5.4 | open, Yahoo `insiderTransactions` |
| Institutional ownership on a stock page | TipRanks | S | 5.5 | open, Yahoo `institutionOwnership` |
| A feed of what happened to your stocks (earnings, big moves, targets) | TipRanks | M | 5.6 | open |
| Portfolio hit rate and return over time | TipRanks | M | 5.7 | waits for weeks of snapshots, like 58 and 59 |

Skipped: 3D aircraft and camera views (Flightradar24), Smart Scores and blogger opinions (TipRanks, made-up numbers and opinion), surf and wave forecasts (Windy), a manual expense keypad (Monefy, we read statements). The apple audit found no teal, purple or indigo and no em dashes in UI strings.

## Mobbin pass 9 (90.0, 2026-10-30: Origin, Cleo, M1 Finance, eToro)

| Gap | Seen in | Size | Version | Status |
|---|---|---|---|---|
| "Due in 3 days" on upcoming bills | Origin | S | 91.0 | done 91.0.0 |
| This month's spending day by day against last month's | Origin | M | 92.0 | done 92.0.0 |
| "Spent less than you earned in 4 of the last 6 months", with a dot per month | Cleo | S | 93.0 | done 93.0.0 |
| A repeat mark on recurring charges in Recent Activity | Origin | S | 94.0 | done 94.0.0 |
| Yield on each holding row | M1 Finance | S | 95.0 | done 95.0.0 |
| Your yearly dividend from a stock, in its Your Position card | M1 Finance | S | 96.0 | done 96.0.0 |
| Biggest single expense this month as an insight | Origin | S | 97.0 | done 97.0.0 |
| The last seven days of spending as daily bars | Origin | S | 98.0 | done 98.0.0 |
| Polish pass over the cards 91 to 98 | apple skill | S | 99.0 | done 99.0.0 |

Skipped: AI advisor chat and partner sharing (Origin, M1), cash advances, credit building and the money quiz (Cleo), margin loans and auto-invest (M1, a brokerage), copy trading (eToro, social). The apple audit found no teal, purple or indigo.

## Mobbin pass 8 (80.0, 2026-10-30: Simply Wall St, Wealthfront, Betterment, SoFi, Stash)

| Gap | Seen in | Size | Version | Status |
|---|---|---|---|---|
| Exposure by listing country (US, Canada, crypto) as bars | Simply Wall St | S | 81.0 | done 81.0.0 |
| News about your holdings: a Holdings chip on the news list | Simply Wall St | S | 82.0 | done 82.0.0 |
| Recent activity: the last few transactions on the spending screen | Betterment, SoFi | S | 83.0 | done 83.0.0 |
| Dividends received this year, read from statements | Betterment | S | 84.0 | done 84.0.0 |
| Interest earned this year, read from statements | Wealthfront, SoFi | S | 84.0 | done 84.0.0, same card |
| A greeting over the portfolio with what changed since your last visit | Betterment | S | 85.0 | done 85.0.0 |
| Concentration flag when one holding is over a quarter of the portfolio | Simply Wall St | S | 86.0 | done 86.0.0 |
| Analyst price target and consensus on a stock page | Simply Wall St, Stash | S | 87.0 | done 87.0.0 |
| Tap an account to see what's in it (holdings and cash; broker accounts carry no transactions) | Betterment, SoFi | M | 88.0 | done 88.0.0 |
| Polish pass over the cards 51 to 88 added: spacing, type, light and dark | apple skill | S | 89.0 | done 89.0.0 |

Skipped: high-yield cash, robo portfolios, tax-loss harvesting and direct indexing (Wealthfront, Betterment, need a brokerage), fair value estimates and community narratives (Simply Wall St, a made-up number and social), round-ups and stock rewards (Stash). The apple audit found no teal, purple or indigo.

## Mobbin pass 7 (70.0, 2026-10-30: CNBC, Investing.com, Questrade, Spendee, Goodbudget, Wallet)

| Gap | Seen in | Size | Version | Status |
|---|---|---|---|---|
| Percent-move price alerts: tell me when it moves 10 percent | Investing.com | S | 71.0 | done 71.0.0 |
| Portfolio header with today's and total gain for the holdings | Investing.com, Questrade | S | 72.0 | done 72.0.0 |
| Net per month on the money in vs spending chart | Goodbudget, Wallet | S | 73.0 | done 73.0.0 |
| Today marker on each budget bar, so pace reads at a glance | Spendee, Goodbudget | S | 74.0 | done 74.0.0 |
| Year to date spend per category as a plain insight | Spendee | S | 75.0 | done 75.0.0 |
| Watchlist sort by name, price or percent change on iPhone and Mac | CNBC | S | 76.0 | done 76.0.0 (Mac already sorted it with the list) |
| Debt payoff chart with a finish date on iPhone and Mac | Goodbudget | M | 77.0 | done 77.0.0 |
| Earnings history on a stock: EPS actual against estimate, last four quarters | Investing.com | M | 78.0 | done 78.0.0 |
| Economic calendar: next CPI, jobs report and rate decision | Investing.com | M | 79.0 | rate decisions done 79.0.0; CPI and jobs wait on a BLS key (bls.gov blocks scripted requests) |

Skipped: live TV (CNBC), options, custom indexes and agentic trades (Questrade, trading), shared envelopes and bank connections (Goodbudget, Wallet, we read statements), community sentiment and expert picks (Investing.com, social and opinion). The apple audit found no teal, purple or indigo and no em dashes in UI strings.

## Mobbin pass 6 (60.0, 2026-10-30: Fidelity, Acorns, PocketGuard, Emma, Revolut, Finimize)

| Gap | Seen in | Size | Version | Status |
|---|---|---|---|---|
| Today's gain in dollars on each holding row | Fidelity | S | 61.0 | done 61.0.0 |
| Leftover this month: expected income minus the bills still to come | PocketGuard | S | 62.0 | done 62.0.0 |
| Bills grouped by month with a total per month, next 60 days | PocketGuard | S | 63.0 | done 63.0.0 |
| Budget ring: how much is left of the month's total budget | Emma | S | 64.0 | done 64.0.0 |
| Subscriptions split into active and stopped | Emma, PocketGuard | M | 65.0 | done 65.0.0 |
| Accounts grouped by type with a total per group | Emma | M | 66.0 | done 66.0.0 |
| Valuation line on a stock: its P/E against the S&P 500's | Finimize | S | 67.0 | done 67.0.0 |
| Top Spending steps back through past months | PocketGuard | S | 68.0 | done 68.0.0 |
| Read the daily brief aloud on device | Finimize | M | 69.0 | done 69.0.0 |

Skipped: round-ups, recurring buys and cash-back offers (Acorns, needs trading and a card), joint accounts, payments and cards (Revolut, banking), live chat with an advisor (Fidelity), expert articles and a members' club (Finimize, Acorns, content we don't have), cancelling subscriptions for you (PocketGuard, needs a concierge). The apple audit found no teal, purple or indigo, white text only on solid fills, gradients only as chart area fades, and no em dashes in UI strings.

## Mobbin pass 5 (50.0, 2026-10-30: Stock Events, getquin, Snowball Analytics, Bloomberg, Credit Karma, Flighty)

| Gap | Seen in | Size | Version | Status |
|---|---|---|---|---|
| Your position on a stock's page: shares, average cost, today's and total gain | Stock Events | S | 51.0 | done 51.0.0 |
| Upcoming card: earnings and dividend dates for holdings and the watchlist in the next 14 days | Stock Events, Snowball | M | 52.0 | done 52.0.0 |
| Holdings by sector, as bars, from the sector map 41.0 added | getquin | S | 53.0 | done 53.0.0 |
| This month's top spending as one stacked bar with a legend | Credit Karma | S | 54.0 | done 54.0.0 |
| News remembers the topic you follow | Bloomberg | S | 55.0 | done 55.0.0 |
| Bill payment history: a row of paid months per recurring bill | Credit Karma | M | 56.0 | done 56.0.0 |
| Dividend calendar: next pay dates and estimated amounts by month | Snowball, getquin, Stock Events | M | 57.0 | done 57.0.0 |
| Portfolio against the S&P 500 over 1M, 3M, YTD | Snowball, getquin | M | 58.0 | waits for weeks of 38.0 snapshots |
| Monthly returns heat grid | getquin | M | 59.0 | waits for weeks of 38.0 snapshots |

Skipped: credit scores, cards, loans, insurance and tax (Credit Karma, needs a credit bureau), AI investment scores (getquin, a made-up number), live TV, radio and CarPlay audio (Bloomberg), friends and shared trips (Flighty, social), Live Activities (Flighty, L; later). The apple audit found no teal, purple or indigo, white text only on solid fills, emoji only on map pins and their chips, and em dashes only as lone placeholders for missing values; it labelled the web news drawer's close button.

## Version plan to v100
One theme per major, built from the open items below. Each major ships on web, iPhone and Mac together.

| Version | Theme |
|---|---|
| 9.0 | Money at a glance: upcoming bills, cash flow bars, insight cards, review queue (#179) |
| 10.0 | Map: filter bar by incident type and time, saved places with incident counts |
| 11.0 | Instant open: cached prices on launch, real watchlist in the widget and Lock Screen (done 11.0.0) |
| 12.0 | First run for everyone: empty fallbacks, no personal demo data, the drop-a-statement card (done 12.0.0) |
| 13.0 | Google sign-in on iPhone and Mac (server is done; blocked on the new callback URL in Google console, #210) |
| 14.0 | Multiple named watchlists (done 14.0.0) |
| 15.0 | Mac extras: menu bar ticker, Notification Center alerts (done 15.0.0) |
| 16.0 | Price alerts with the apps closed: the server checks every 15 minutes and emails (done 16.0.0). APNs push still needs a key (#180) |
| 17.0 | Commodity and crypto detail parity with stocks (done 17.0.0) |
| 18.0 | Trading: size by allocation, live autopilot caps (needs Joshua, skipped for now) |
| 19.0 | Design debt: colour rule violations (done 19.0.0; the news drawer drag still needs an on-device look, see below) |
| 20.0 | A fresh Mobbin pass, written into a new table (done 20.0.0, "Mobbin pass 2" above) |
| 21 to 29 | One row each from "Mobbin pass 2" (done except 28.0 and two 29.0 rows) |
| 30 | Mobbin pass 3 plus an apple audit (done 30.0.0) |
| 31 to 38 | One row each from "Mobbin pass 3" (done except 35, parked, and 37, waiting on history) |
| 39 | Map popups: OpenStreetMap names escaped in the emergency pins; event filtering and event detail were already covered by 10.0 (done 39.0.0) |
| 40 | Mobbin pass 4 plus an apple audit (done 40.0.0) |
| 41 to 49 | One row each from "Mobbin pass 4" (done; net worth over time parked, 49.0.0 took QA leftovers) |
| 50 | Mobbin pass 5 plus an apple audit (done 50.0.0) |
| 51 to 59 | One row each from "Mobbin pass 5" (51 to 57 done; 58 and 59 wait on snapshots) |
| 60 | Mobbin pass 6 plus an apple audit (done 60.0.0) |
| 61 to 69 | One row each from "Mobbin pass 6" (done 69.0.0); the 58 and 59 rows ship as the next version once snapshots exist |
| 70 | Mobbin pass 7 plus an apple audit (done 70.0.0) |
| 71 to 79 | One row each from "Mobbin pass 7" (done 79.0.0) |
| 80 | Mobbin pass 8 plus an apple audit (done 80.0.0) |
| 81 to 89 | One row each from "Mobbin pass 8" (done 89.0.0) |
| 90 | Mobbin pass 9 plus an apple audit (done 90.0.0) |
| 91 to 99 | One row each from "Mobbin pass 9" (done 99.0.0) |
| 100 | Mobbin pass 10 plus an apple audit (done 100.0.0; snapshots not in yet, so 58 and 59 still wait) |
| 101 to 109 | One row each from "Mobbin pass 10" |
| after 100 | Every 10th major is a Mobbin pass and an `apple` skill audit; the nine in between take the next open group below, oldest first |

## 2026-10-29 QA leftovers (open)
- [ ] iPhone and Mac allocation donut adds USD holdings to CAD cash at face value (the web was fixed in 49.0.0); the native apps need the CADUSD=X rate first.

## 2026-10-01 brain dump (open)
- [ ] TradingView bot live testing (restart with --remote-debugging-port=9222, run `node scripts/tv-signal-agent.js --study Surf --dry-run`)
- [ ] Menu bar second-by-second P&L: needs IB's streaming P&L feed, the 60 second poll only refreshes what Gateway already updates every few minutes.
- [ ] Offline mode
- [ ] Search UX pass beyond the contrast fix

## 2026-10-04 map QA leftovers (open)
- [ ] Open Places once OpenStreetMap is back and watch the list swap from Apple Maps to the fuller list. Overpass was down all of 2026-10-04, so that swap shipped in iOS 2.5.17 without ever running.
- [ ] The onboarding stamp fix in `OnboardingView.swift` (session restored inside the settle window never got marked as seen) applies to every app that carries a copy of that file.

## Revenue check, 2026-09-11

Handoff: paused at Joshua's request to conserve usage. Changes are local and uncommitted; no deployment or release. Confirmation remains pending. Completed checks and next steps: [revenue handoff](../REVENUE.md).

ASC: iOS 2.5.11 WAITING_FOR_REVIEW; macOS 2.5.2 READY_FOR_DISTRIBUTION. Premium IAP com.heyitsmejosh.epiphany.premium is APPROVED. Older notes saying the IAP does not exist or the current submission is rejected are superseded.

Local payment fixes: failed storage reads/writes no longer report a successful unlock; IAP ownership is reserved atomically; Stripe waits for confirmed payment and retries failed entitlement writes. Paid feature enforcement still depends on EPIPHANY_REQUIRE_PRO=true. Verify the deployed flag and a real sandbox purchase before promoting the paid offer. See ../REVENUE.md.

## Google sign-in on native: server is DONE, only the client is missing (verified 2026-08-28)

`https://epiphany.heyitsmejosh.com/api/auth?action=google` returns a live **302** to
accounts.google.com using client_id `455155642136-...apps.googleusercontent.com`, the same
Google Cloud client the shared Supabase project uses, with redirect_uri
`https://epiphany.heyitsmejosh.com/api/auth?action=google-callback` already configured.

So the "blocked on Joshua registering a Google app" note elsewhere is **stale for Epiphany**.
The web half works today. What is actually missing for iOS/macOS:

1. A Google button in `ios/Views/LoginSheet.swift` + the macOS equivalent, driving
   `ASWebAuthenticationSession`.
2. A custom URL scheme, Epiphany has **none** registered. Add `CFBundleURLTypes` via
   `ios/project.yml`'s generated info block, never the plist (xcodegen rewrites it).
3. A server change so the google-callback can redirect back to `epiphany://` for the native
   client instead of only to the web app.

Update 2026-10-21: Apple is back next to Google for 3.0.1 (Guideline 4.8). It was removed 2026-08-28 to clear the Guideline
2.1(a) rejection and 2.5.6 is in review on that basis; revisit only after a verdict.

## 2026-08-10 (late), UI + data pass, shipped
- [ ] **Not verified this session**: iOS statement upload with a real PDF. The web path and
  all builds pass, but Josh's "haven't seen it work in months" on mobile was not reproduced
  or confirmed fixed. Do this first next session.

## Urgent
- [ ] SnapTrade billing: Josh believes it was paid, not independently re-verified this session (ran out of time/budget). Confirm via SnapTrade dashboard before trusting the "disabled key" urgent item above is stale.

## Markets news drawer drag, still choppy (3 attempts, all failed)
User confirmed live on-device it's not as fluid as native iOS Stocks, across three separate fix attempts (07-07, 07-07 later, 07-22, reverted, commit `69f82c6`). Root cause not found. Do NOT attempt a 4th blind fix.
- Attempt 1: moved `.frame(height:)` off per-drag resizing to a fixed max-height + outer clip animation. Real perf issue, not the (or not the only) felt cause.
- Attempt 3: replaced per-drag resize with `.offset(y:)` compositor transform (textbook fix for this SwiftUI pattern), broke drag hit-testing (touch passed through to the row underneath instead of moving the drawer). Reverted. Suspected cause: the drag handle's `.overlay(alignment: .top)` is attached to the offset-shifted view, whose own layout frame stays fixed size, something in the offset→padding→overlay→clipped chain desyncs the touch target from the rendered position.

## Epiphany Mac merge (ASC)
- [ ] Old orphaned "Epiphany Mac" app record (6782703473, bundle `com.heyitsmejosh.epiphany-macos`) needs Joshua's manual ASC dashboard deletion, no public API to delete an app record (confirmed on Talli's/Voxprint's equivalent orphans too). Do not upload anything further to it. Full merge history/blockers (upload error 90348, three widget compile fixes) preserved in CLAUDE.md.

## Brand & landing page
- [ ] Landing page screenshots must use a real populated account, not a demo account (currently renders an empty portfolio, looks broken on the marketing site).

## Trading / brokerage
- [ ] **IBKR broker adapter, blocked on IBKR account approval**: Joshua started an Interactive Brokers Canada individual application on 2026-09-06 and is filling KYC forms. Once approved, write `server/api/broker/ibkr.js` mirroring the existing `alpaca.js` stub interface (paper account endpoint, execute trade with symbol/qty/side). Wire it into `broker/morning-run.js:runLive()` in place of the Alpaca call. Alpaca is blocked because it rejects Canadian residents. IBKR is the funded path forward for live autopilot trading in Canada.
- [ ] **Evaluate replacing SnapTrade with Interactive Brokers**, SnapTrade is read-only by design (blocks live trading, forced `AutopilotSection()` to be commented out); IBKR Web API would unblock it. Needs scoping: auth model, holdings/positions endpoints, cost, SnapTrade sync-layer reuse. (The SnapTrade billing outage above is a good moment to revisit this.)
- [ ] Live trading blocked on a trade-permissioned brokerage, **needs Joshua**. Alpaca blocked: rejects Canadian residents, hides paper accounts behind US application. IBKR only if TSX/Canadian equities needed later. RBC confirmed no public trading API. Researched 2026-07-22: IBKR does not bridge to Wealthsimple; the only way to execute trades *in* a Wealthsimple account is unofficial reverse-engineered wrappers that violate WS's ToS, not viable. Real path is a separate IBKR/Alpaca account, SnapTrade/WS stay read-only for display only.
  **2026-09-03**: unlocked live-mode plumbing ahead of the broker swap: `autopilot.js` accepts `mode:'live'` from the client (was hardcoded to paper), `morning-run.js` runs the full watchlist in live mode (was BTC-only probe) with a hard $50/trade cap + 20-trade total cap then auto-revert to paper, `TradeWorkflow.jsx` has a Paper/Live toggle. Still wired to SnapTrade under the hood, which is a no-op for real fills against Wealthsimple (see above). Swap the execution call in `runLive()` to IBKR once the adapter exists and the account is approved, nothing else in this plumbing needs to change.
- [ ] **BLOCKED (Joshua):** "Login with TradingView" to sync watchlist, no public TradingView API for reading a user's watchlist/account. Receiving endpoint already exists (`server/api/broker/webhook.js` accepts `{ticker, action, qty}`, places Alpaca paper orders), only remaining step needs Joshua's TradingView Pro+ account to configure an outbound webhook alert. Can't self-provision.
- [ ] Autopilot copy ("Pilots"): curated famous-investor model portfolios (congress trades + 13F trackers, read-only vs SnapTrade) with performance-vs-you + new-trade alerts; web first, mirror iOS. Feature notes in wiki `pages/epiphany.md`.
- [ ] `src/App.jsx` `ASSETS` const (~180 tickers, fallback-only) and the Watchlist, both tightly coupled to the 978-line trading simulator, used in 6+ places. Not safe to blind-edit; needs its own dedicated session for both together.

## Other open items
- [ ] Markets-row buy/sell/hold badge on the list view, the "why" panel itself already ships (tap BUY/SELL/HOLD pill on `StockDetail.jsx` for reasons + math rationale). Putting it on each Markets-list row is blocked: `MarketRow` only gets symbol/name/price/changePercent, but `signal()` needs 35+ price points, needs either N per-row history calls or the bulk price-history endpoint already deferred for sparklines. Same blocker, fix together.
- [ ] Portfolio/Settings tab audit, getting cluttered, decide what stays. Calendar view specifically flagged as possibly unnecessary.
- [ ] iOS landscape support, one-line flag, but map/markets/portfolio are portrait-first; enabling without adapting layouts looks broken. Needs a per-screen pass (split layouts, wider charts, map controls). Same applies to other iOS apps. Also: Holdings "Display metric" row needs per-holding day-change data from backend (model only has marketValue + gainLoss).

## From Apple Notes (imported 2026-08-11)
- [ ] **Needs Joshua: re-upload the June 2026 statement.** Consequence of the month-labelling
  bug above, because July was mislabelled "Jun", the upload handler's dedupe treated it as a
  duplicate of June and *replaced* the June record in KV. The parser fix stops it recurring and
  `refreshStoredStatements` self-heals stored records below `SUMMARY_VERSION` (4), but it cannot
  recover a record that was overwritten. If the June PDF still exists in Blob it may survive as
  an orphan; otherwise just re-upload June, then July, and confirm both now appear as separate
  months.
- [ ] iOS: fix "Login with …" (social sign-in buttons), **blocked, not a code bug.** `server/api/auth.js` already has complete hand-rolled Google (`:202-268`) and Facebook (`:270-329`) flows; `GOOGLE_CLIENT_ID`/`SECRET` are present but empty and `FACEBOOK_CLIENT_ID`/`SECRET` are unset. Needs Joshua to register the apps in Google Cloud Console / Meta for Developers, then set them as Worker secrets (`npx wrangler secret put`). No code change unblocks this.
- [ ] Web price alerts panel stays dark in light mode: its `var(--bg-secondary, #18181b)` fallbacks win because those CSS variables aren't defined; move it to the theme tokens (seen in 21.0 QA).
- [ ] Web landing page needs a light mode (looks great otherwise), note `CLAUDE.md`'s standing rule "Web: dark only (Gotham brand, hardcoded dark surfaces)"; this item contradicts it, so confirm the rule is being retired before implementing.
- [ ] Mac app: thorough end-to-end test pass

## Design debt, standing colour rule violations
- [ ] Stock view: add live mode (seconds-level timeframe, not just minute)
- [ ] Make the "Buy/sell/hold" button clickable → opens a drawer of sources
- [ ] Add themes (dark mode etc.) to the stocks view

## Ingested 2026-08-18
- [ ] Venue reviews via Google Places, DEFERRED 2026-09-07 (Joshua: later). Yelp key is dead (400) and every reviews API (Yelp, Google Places, Foursquare, TripAdvisor) requires a credit card on file even for the free tier. Needs Joshua to add a card + accept ToS at console.cloud.google.com (project winnie-372220, Places API enable started). Then: create key, `wrangler secret put GOOGLE_PLACES_API_KEY`, port `server/api/venue-details.js` from Yelp to Places (New). `/api/venue-details` stays `{available:false}`. If photos alone are wanted later, Wikimedia Commons geosearch is keyless.

## Braindump 2026-08-19
- [ ] Predictions feature: integrate or build prediction markets in the spirit of Wealthsimple Predict / Polymarket / Kalshi. Decide integrate-vs-build; check each for a public API.
- [ ] Social layer copying Loopt (friend map / presence). Reference: https://youtu.be/KhhId_WG7RA?si=c0cu-aQHq087KJeF

## Landing page: live demo background (2026-08-19)
Splash/hero background is a static image preview of the app. Replace with a live,
non-interactive demo of the real app rendering behind the hero (pointer-events:none,
demo/mock data, no auth). After sign-up, the same view becomes the real interactive
app and the marketing chrome (Log in / Get Epiphany / Get started) hides.
Scope: large UI change, do in a dedicated session.

## Ingested 2026-08-22
- [ ] Add a police scanner feature.
- [ ] Build upon the ontology / people index feature.
- [ ] Portfolio syncing is laggy and unreliable, "It's working but not reliably, or very fast. I deposited into my chequing account, Epiphany took days to reflect it." Investigate sync freshness/latency end to end.

## From Apple Notes (imported 2026-08-25)

- [ ] Mobile web UI/UX is spotty overall, general pass needed.
- [ ] `/api/cron` hits the Workers subrequest cap. The first Cloudflare-run cron
  (2026-08-26 08:00 UTC) completed 200, but logged `[KV] set error: Too many
  subrequests by single Worker invocation` twice, so part of the cache write was
  dropped. The handler fans out to 111 stock symbols plus markets and commodities,
  each its own fetch, then writes several KV keys, that is well past the
  per-invocation subrequest limit. Fix is to batch the Yahoo fetches or split the run across the three cron
  slots; raising the limit is a plan change, not a config flag. Also visible in
  the same run and probably older: `Cron crypto fetch failed: HTTP 403`.

## From Apple Notes (imported 2026-08-27)
- [ ] "One big dot for the entire city" on web: not yet root-caused. With almost every layer empty, the surviving markers cluster into a single badge (`clusterPoints` in `src/components/LiveMapBackdrop.jsx`, radius 60 at initial zoom 10.6). Re-check now that flights layer is returning real data.
- [ ] Loading glitch in the top App Store bar on web.
- [ ] People indexer does not work. Expand it and add AI support (Qwen etc).

### Open, security

- **Rotate the two dashboard-gated secrets** (2026-08-27 security sweep). Fresh
  `WEBHOOK_SECRET` + `CRON_SECRET` were already regenerated locally in
  `.env.tui.local` and need pushing to the Worker with `npx wrangler secret put` (my broker/webhook + autopilot
  cron endpoints now 503 until the secret is set in prod). Still to do by hand,
  because no API mints these headlessly:
  - `STRIPE_SECRET_KEY` (roll `sk_live_` at dashboard.stripe.com/apikeys)
  Run `scripts/rotate-keys.sh` to open the dashboards.

## Portfolio + Markets feedback (2026-09-03)
- [ ] Markets list: add a Buy/Hold/Sell group filter using `Indicators.TradeSignal` (ios/Helpers/Indicators.swift L75); needs per-symbol history so compute lazily/cached. Default sort is already `% Change` (MarketsView.swift L12).

## Trading benchmark (loop, 2026-10-01)
Goal: a benchmark solid enough to quote in WHITEPAPER.md. Engine is `tradingview/backtest.py`. One item per pass, commit each.
- [ ] ETH and GLD next to BTC, so crypto and gold aren't one lucky asset each
- [ ] Walk-forward: re-pick settings each year on the past only, score the next year, chain the years
- [ ] MCP parity: run one strategy in TradingView's Strategy Tester through the MCP, match its trades and P&L to the engine
- [ ] Write results to `tradingview/results.json`, generate the WHITEPAPER benchmark section from it, add a test that fails if the two drift
- [ ] Double 7s as a portfolio across all 429 stocks at once, so cash is always working (yearly return, not just per trade)
- [ ] Decide whether Double 7s belongs on the Buy/Hold/Sell badge. Held back on purpose: it says Hold most days, which would make the badge near useless. Better as an extra line in the stock detail view on web, iOS and macOS

## Ingested 2026-10-01
- [ ] Platform sync: Apple Watch target does not include `Shared/`, so `double7s()` and the rest of the signal code are missing there; verify Android, Windows and Linux builds match web
- [ ] Budget should read income statements dynamically instead of a typed Monthly Income; phone device debt should calculate dynamically too. Screenshot: notes/attachments/2026-10-01/epiphany-3.png. 2026-10-01: KV data fixed. Still open: statements can't tell paycheques from card payments, so income from statements needs a deposit/account tag first; phone debt needs a start date and monthly payment (minPayment is 0) before it can count down
- [ ] Yelp key on Cloudflare returns 400 (key set but rejected, Yelp Fusion went paid). Needs a fresh key from the Yelp developer portal (Chrome job). It only adds review photos and ratings. Only the iOS 17 / macOS 14 fallback sheet uses `/api/venue-details` now, so drop it or swap the source.

## QA loop 2026-10-01
Pass 1 (simulator, signed in): Map B (emoji pins, dense construction markers), place card A (Look Around nil on simulator only, works on device), Markets B (rows blank in demo, ticker fixed), Portfolio A-, Settings A.
- [ ] Map pins use emoji (car, warning, fire truck, construction); swap to SF Symbols per the no-emoji rule
- [ ] Markets list rows render blank in UITEST_DEMO mode
Pass 2: Map B+ (no emoji, incidents and traffic cluster, venues merge into one grey badge per block at wide zoom; traffic and incident badges still overlap each other), icon A- (lines readable, hub glows; hub flat, uniform line weight), place card A, Portfolio A-, Settings A.
- [ ] Promo video in the spirit of the Joshua Tree one, add to README and landing (which Joshua Tree video, the landing hero or something else?)
- [ ] Refresh screenshots: App Store (fastlane, UITEST_DEMO), README, landing, after the icon and map land
- [ ] App Store "About this app" text: cut to the Wealthsimple shape, one line of what it is, three short feature lines, one trust line (metadata/app-info/en-CA.json)
- [ ] Statements: April 2026 is still missing from the account, upload it from the Wealthsimple Cash account; verify an upload from the phone after 2.5.15 ships
- [ ] Statements: teach the parser the TFSA statement (contributions, withdrawals, buys, sells) so it feeds holdings instead of being skipped
- [ ] Web statement uploader still posts only the PDF; send pdf.js text like the native apps do so the Worker never parses
- [ ] App Store screenshot lane: fastlane green but only 1 of 5 shots per device land (UI test stops after the map); fix PreviewScreenshot.swift then rerun
Pass 5: icon A (SF-weight uniform stroke, no glow, flat near-black, hub with white dot, systemTeal hub colour removed; regular heptagon tried and rejected as a ship's wheel). Map in NYC at four zoom levels A- (one badge per block, local events clustered). Markets A-.
Pass 6: Liquid Glass icon via Apple's Icon Composer (ios/Epiphany.icon, macos/Epiphany.icon): hub, nodes and lines as separate glass groups over a flat dark fill; Default, Dark, Tinted and Clear all render with ictool; flat AppIcon set stays as the fallback below iOS 26. Grade A+ pending Joshua's eye on a real phone.

## Cloudflare audit 2026-10-01
Fixed and deployed tonight: /api/latest self-fetched its own domain (522 every time, cron snapshot never served); defuddle used redirect "error" which workerd rejects (every article extract 500ed); statement PDFs were served unauthenticated and publicly cacheable via /api/blob and could never be re-read server-side (stream vs bytes); stocks-free fanned out two FMP calls per symbol for the 70-symbol Watch and widget list (19s then 500), now Yahoo batch for long lists.
- [ ] macro returns [] and fear-greed is unavailable live: upstreams refuse Cloudflare egress (server/api/macro.js:36, fear-greed.js); find sources that allow it or proxy
- [ ] _blob.js list() is one unpaginated KV page sorted lexicographically, size always 0

## Competitor gaps (sweep 2026-10-01: Copilot, Monarch, Apple Stocks, Yahoo, Robinhood, Citizen, Google Maps)
- [ ] Layers button on the map itself: toggle Flights, Traffic, Incidents, Weather, Quakes, Wildfires, AQI without leaving the map (vs Google Maps Layers sheet with Traffic, T). ios/Views/SituationView.swift:772 layerPickerButton is already a Menu of basemap styles; add a second `Section("Layers")` with `Toggle("Flights", isOn: $showFlights)` etc. bound to the nine @AppStorage flags that already exist at :115-124 (SettingsView.swift:649 keeps its copies, same keys). macos/Views/SituationView.swift:564 same Menu, bound to appState.situation*Enabled (the bindings SettingsView.swift:390 sourceB
- [ ] Map that is fast and stays alive: skip the refetch on tiny pans, stop the flight timer when there is nothing to move, honour Low Power Mode, and reload every 5 minutes while the tab is open (vs Google Maps and Apple Maps only re-searc). ios/Views/SituationView.swift: add `@State private var lastLoadedRegion: MKCoordinateRegion?`; in .onMapCameraChange (:687) compute centre delta vs lastLoadedRegion and if it moved under 25% of the previous span and latitudeDelta ratio is within 0.5 to 2, run only refreshVenues and return; set lastLoadedRegion at the end of loadData (:873). :169 flight timer: `guard showFlights, !flights.isEmpty, !ProcessInfo.process
- [ ] Search any ticker or company name and add it to the watchlist (vs Apple Stocks search returns any symbol b). New server/api/search.js: GET ?q=, calls Yahoo `v1/finance/search?q=&quotesCount=8&newsCount=0` with YAHOO_HEADERS from stocks-shared.js (same unofficial endpoint family stocks-free.js:190 already uses), returns [{symbol, name, exchange, type}], KV cache 10 min keyed by lowercased q. Register in api/gateway.js (import plus the route map at :29 and the cache seconds table at :105). ios/Views/MarketsView.swift:274 bott
- [ ] Web map keeps its last pins and tiles when the network drops (vs Apple Maps offline areas). vite.config.js:64 workbox block: add `runtimeCaching: [ { urlPattern: /basemaps\.cartocdn\.com/, handler: 'StaleWhileRevalidate', options: { cacheName: 'tiles', expiration: { maxEntries: 500, maxAgeSeconds: 7*24*3600 } } }, { urlPattern: /\/api\/(flights|traffic|incidents|earthquakes|weather-alerts|wildfires|aqi|crime|local-events|stocks-free|commodities|crypto)/, handler: 'NetworkFirst', options: { cacheName: 'api',
- [ ] Pin age for earthquakes and weather alerts: '42 min ago' in the sheet and faded pins past 24 h (vs Citizen colour-codes pins by age). Scoped down from the candidate: /api/incidents is an Overpass query for construction sites, police and fire stations, museums and bus stations (server/api/incidents.js:130-172), static map features with no event time, so incident age is not a thing. Real timestamps exist for quakes (server sends `time` epoch ms at earthquakes.js:57; Shared/SituationData.swift:62 already lists `time` as a coding key but only fills the
Bigger, parked:
- [ ] Per-category budget vs actual with an on-track colour, mid-month projection, in the Budget tab and the Budget widget (day, high): budget.expenses lines (src/components/FinancePanel.jsx:1257, server/api/portfolio.js mergeBudget, src/utils/financeData.js validatePortfolioData) have no category key, so first add one and a picker from the statement cat
- [ ] Review queue: 'N rows to sort' card after upload with two suggested categories per row and Mark all reviewed (day, medium): Builds on the rules map from the categorization quick win: suggestions come from the stored rules plus the most common category for similar merchant text. Web card at the top of the spending tab in src/components/Finance
- [ ] Push notifications that fire with the phone in your pocket: price alerts, nearby severe weather, M4+ quakes, wildfires, bill reminders (week, high): Candidates 6, 7 and 15 collapse into one piece of infrastructure. Server: a 5-minute cron (wrangler.jsonc:27 triggers and the path map at worker/index.js:145; today the only data cron is 08:00 weekdays) sweeping Supabase
- [ ] Earnings and dividend dates merged into the Portfolio financial calendar with Add to Calendar (hours, medium): Follow-up to the earnings quick win once nextEarnings is on the Stock model: ios/Views/PortfolioView.swift:555 buildCalendarEvents merges watchlist and holdings earnings dates, StockDetailView gets an EKEvent button. Lis
Dropped on purpose: Copilot-style ML category prediction from amount, weekday and card: a per-user merchant ru; Rocket Money SMS assistant texting you about price increases and new subscriptions: needs ; Watch Duty evacuation orders subscribed by county: requires a regional evacuation-order fe; Citizen-style following an incident from first report to resolved: /api/incidents is an Op; Flightradar24 7700 emergency squawk alerts: needs continuous aircraft polling in the backg; Apple Maps-style full offline area download: MapKit exposes no tile download API and the C

## Ingested 2026-10-02
- [ ] Add the jobs report.

## Ingested 2026-10-21
- [ ] Login broken after the new domain change. Sign-in sheet sits on a spinner. (screenshot: notes/attachments/2026-10-21/epiphany-1.png) Cause: iOS 2.5.17 calls the dead heyitsmejosh host; 3.0.0 (in review) already uses jaybulb. Web: SITE_URL secret moved to jaybulb 2026-10-21. Left: add https://epiphany.jaybulb.com/api/auth?action=google-callback to Google client 455155642136 (project epiphany-501805) and the github-callback to the GitHub OAuth app. Native Apple and Google buttons go in 3.0.1.
- [ ] [P1] Stale App Store links. (2026-10-21: every epiphany link in code already points at id6779522175, so the stale ones are elsewhere. Which page or app? Need the URL.)
- [ ] [P2] Map: places render on the map. What other details could we be displaying? (sheet today shows hours, phone, website, address, Get Directions) (notes/attachments/2026-10-21/epiphany-4.png)
- [ ] [P3] Remove Debt & Calendar's calendar unless we can find a use for it. (notes/attachments/2026-10-21/epiphany-6.png)

## QA pass 2026-10-21 (web, iOS)
- [ ] Web map heatmap renders as one opaque red blob over Maple Ridge/Langley. Lower opacity or radius so streets show through.
- [ ] Web Fear & Greed is still empty: CNN blocks Workers egress (418). iOS and macOS now fetch CNN from the device when the server has nothing; web needs another source.
- [ ] iOS Settings signed out: Map and Appearance sections added 2026-10-21, builds, not yet seen signed out in the simulator (keychain kept the session).

## Ingested 2026-10-25
- [ ] Custom map UI overlay and similar, based off our design kit, and hide all settings inside Settings.
- [ ] Configure with Alpaca, finally. The project is a year old; it should be able to buy and sell and even auto trade. SPCX detail screen currently says "Trading is temporarily disabled, back soon" (screenshot ~/Documents/Code/notes/attachments/2026-10-25/epiphany-1.png); Settings shows Autopilot on paper money, last trade sell XLV. Note: Alpaca rejects Canadian residents, see the IBKR/brokerage item above, so this needs a decision on which broker.
- [ ] Live updating price, change and change percent like TradingView, red on numbers going down, green going up. Reference watchlist (VIX, WTI, NAS100, BTCUSD...) with per-digit colouring: ~/Documents/Code/notes/attachments/2026-10-25/epiphany-3.png
