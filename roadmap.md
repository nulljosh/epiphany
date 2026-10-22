> Priority tier 2 (2026-10-17): ship push, this week. Order: live blockers, ship pushes, active features, portfolio, exploratory. See ~/Documents/Code/LOOP-HANDOFF.md.

- [ ] Wire Epiphany Sans into the native apps and the web UI. The font files are in `fonts/` and `brand/tokens.css`; no app or web screen uses it yet.

- [ ] Live autopilot for other users is blocked by its own caps, **needs Joshua**: `morning-run.js` live mode caps each trade at $50 but SSO is about $70 and BIL about $91, so Trend 2x buys zero shares. Paper mode has the same problem at the $1 default cap. Past live attempts failed with SnapTrade 1076 (signature), 1068 (no cash), 1121 (rate limit); local CRON_SECRET is stale so `impact-test` could not be rerun. Size by `allocation` % of balance instead of a flat cap, then run impact-test.
## 2026-10-21 (open)

## 2026-10-01 brain dump (open)
- [ ] TradingView bot live testing (restart with --remote-debugging-port=9222, run `node scripts/tv-signal-agent.js --study Surf --dry-run`)
- [ ] Menu bar second-by-second P&L: needs IB's streaming P&L feed, the 60 second poll only refreshes what Gateway already updates every few minutes.
- [ ] Offline mode
- [ ] Better event filtering on the map
- [ ] More info on event tap
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

## RESOLVED 2026-08-26: /api/stocks 500 on the full default symbol list

Cloudflare Workers cap a single invocation at **50 subrequests**. This handler had
THREE per-symbol fan-out paths: FMP quote+ratios (2 subrequests each), the v8 chart
fallback (1 each), and v10 fundamentals enrichment (1 each). The 63-symbol default
list issued well over 100, so everything past the cap failed -- including the Upstash
KV read inside `getYahooCrumb`, which is what finally showed up in `wrangler tail` as
`[KV] get error: Too many subrequests by single Worker invocation`.

A second, independent bug masked it: early returns dropped response bodies without
reading or cancelling them. Workers cap concurrent in-flight responses and an unread
body never completes, so the runtime cancelled the oldest and unrelated fetches failed.
Fixed with `discardBody()`; that removed the stall warnings and exposed the real error.

Fix: Yahoo **v7 batch quote** first (one subrequest for all 63 symbols), with the two
per-symbol paths gated behind `PER_SYMBOL_FANOUT_MAX = 15`. Verified in production:
`/api/stocks` returns 200 with 62 symbols.

Worth remembering: the thrown error said "Yahoo Finance v8 chart API returned no data",
which was misleading -- Yahoo was fine, the Worker had simply run out of subrequests.
Diagnose Workers 500s with `wrangler tail` before trusting the handler's own message.

## 2026-08-10 (late), UI + data pass, shipped
- [ ] **Not verified this session**: iOS statement upload with a real PDF. The web path and
  all builds pass, but Josh's "haven't seen it work in months" on mobile was not reproduced
  or confirmed fixed. Do this first next session.

## Urgent
- [ ] SnapTrade billing: Josh believes it was paid, not independently re-verified this session (ran out of time/budget). Confirm via SnapTrade dashboard before trusting the "disabled key" urgent item above is stale.

## From Apple Notes (imported 2026-08-08)

## OAuth rollout (2026-08-24)

## App icon

## Ship 2.5.4, DONE
Confirmed 2026-08-06: iOS 2.5.4 is READY_FOR_SALE/live. macOS remains at 2.5.2 (statement-upload fix was iOS-only at the time; macOS parity landed separately 08-04, see above), bump macOS if the Mac statement UI work should ship as a version.

## Markets news drawer drag, still choppy (3 attempts, all failed)
User confirmed live on-device it's not as fluid as native iOS Stocks, across three separate fix attempts (07-07, 07-07 later, 07-22, reverted, commit `69f82c6`). Root cause not found. Do NOT attempt a 4th blind fix.
- Attempt 1: moved `.frame(height:)` off per-drag resizing to a fixed max-height + outer clip animation. Real perf issue, not the (or not the only) felt cause.
- Attempt 3: replaced per-drag resize with `.offset(y:)` compositor transform (textbook fix for this SwiftUI pattern), broke drag hit-testing (touch passed through to the row underneath instead of moving the drawer). Reverted. Suspected cause: the drag handle's `.overlay(alignment: .top)` is attached to the offset-shifted view, whose own layout frame stays fixed size, something in the offset→padding→overlay→clipped chain desyncs the touch target from the rendered position.

## Epiphany Mac merge (ASC)
- [ ] Old orphaned "Epiphany Mac" app record (6782703473, bundle `com.heyitsmejosh.epiphany-macos`) needs Joshua's manual ASC dashboard deletion, no public API to delete an app record (confirmed on Talli's/Voxprint's equivalent orphans too). Do not upload anything further to it. Full merge history/blockers (upload error 90348, three widget compile fixes) preserved in CLAUDE.md.

## Brand & landing page
- [ ] Landing page screenshots must use a real populated account, not a demo account (currently renders an empty portfolio, looks broken on the marketing site).

## Commodity/crypto detail parity
- [ ] iOS/macOS mirror of web's commodity/crypto stats grid (dayHigh/dayLow/prevClose, high24h/low24h, backend shipped 07-19). Bigger than a mirror pass: no iOS/macOS view renders `CommodityData`/`CryptoData` at all yet (`StockDetailView.swift` is equity-only), needs a dedicated session to build the detail view first, then add stats fields.
- [ ] Derivable without new backend work: Period High/Low from already-loaded price history; SMA20/EMA50 overlays on the commodity chart (client-side, `StockDetailView` already computes these for equities, reuse). Needs a chart refactor pass.
- [ ] Mirror Yahoo Finance layout: at drawer `.large`, the ticker bar should own ~top 10% of the view, visual-proportion tuning, do live on the sim.

## Trading / brokerage
- [ ] **IBKR broker adapter, blocked on IBKR account approval**: Joshua started an Interactive Brokers Canada individual application on 2026-09-06 and is filling KYC forms. Once approved, write `server/api/broker/ibkr.js` mirroring the existing `alpaca.js` stub interface (paper account endpoint, execute trade with symbol/qty/side). Wire it into `broker/morning-run.js:runLive()` in place of the Alpaca call. Alpaca is blocked because it rejects Canadian residents. IBKR is the funded path forward for live autopilot trading in Canada.
- [ ] **Evaluate replacing SnapTrade with Interactive Brokers**, SnapTrade is read-only by design (blocks live trading, forced `AutopilotSection()` to be commented out); IBKR Web API would unblock it. Needs scoping: auth model, holdings/positions endpoints, cost, SnapTrade sync-layer reuse. (The SnapTrade billing outage above is a good moment to revisit this.)
- [ ] Live trading blocked on a trade-permissioned brokerage, **needs Joshua**: ~~sign up for Alpaca (paper account, free, fastest path) at alpaca.markets~~. ALPACA BLOCKED: rejects Canadian residents, hides paper accounts behind US application. IBKR only if TSX/Canadian equities needed later. RBC confirmed no public trading API. Researched 2026-07-22: IBKR does not bridge to Wealthsimple; the only way to execute trades *in* a Wealthsimple account is unofficial reverse-engineered wrappers that violate WS's ToS, not viable. Real path is a separate IBKR/Alpaca account, SnapTrade/WS stay read-only for display only.
  **2026-09-03**: unlocked live-mode plumbing ahead of the broker swap -- `autopilot.js` accepts `mode:'live'` from the client (was hardcoded to paper), `morning-run.js` runs the full watchlist in live mode (was BTC-only probe) with a hard $50/trade cap + 20-trade total cap then auto-revert to paper, `TradeWorkflow.jsx` has a Paper/Live toggle. Still wired to SnapTrade under the hood, which is a no-op for real fills against Wealthsimple (see above) -- swap the execution call in `runLive()` to IBKR once the adapter exists and the account is approved, nothing else in this plumbing needs to change.
- [ ] **BLOCKED (Joshua):** "Login with TradingView" to sync watchlist, no public TradingView API for reading a user's watchlist/account. Receiving endpoint already exists (`server/api/broker/webhook.js` accepts `{ticker, action, qty}`, places Alpaca paper orders), only remaining step needs Joshua's TradingView Pro+ account to configure an outbound webhook alert. Can't self-provision.
- [ ] Autopilot copy ("Pilots"): curated famous-investor model portfolios (congress trades + 13F trackers, read-only vs SnapTrade) with performance-vs-you + new-trade alerts; web first, mirror iOS. Feature notes in wiki `pages/epiphany.md`.
- [ ] `src/App.jsx` `ASSETS` const (~180 tickers, fallback-only) and the Watchlist, both tightly coupled to the 978-line trading simulator, used in 6+ places. Not safe to blind-edit; needs its own dedicated session for both together.

## Other open items
- [ ] Markets-row buy/sell/hold badge on the list view, the "why" panel itself already ships (tap BUY/SELL/HOLD pill on `StockDetail.jsx` for reasons + math rationale). Putting it on each Markets-list row is blocked: `MarketRow` only gets symbol/name/price/changePercent, but `signal()` needs 35+ price points, needs either N per-row history calls or the bulk price-history endpoint already deferred for sparklines. Same blocker, fix together.
- [ ] Portfolio/Settings tab audit, getting cluttered, decide what stays. Calendar view specifically flagged as possibly unnecessary.
- [ ] iOS landscape support, one-line flag, but map/markets/portfolio are portrait-first; enabling without adapting layouts looks broken. Needs a per-screen pass (split layouts, wider charts, map controls). Same applies to other iOS apps. Also: Holdings "Display metric" row needs per-holding day-change data from backend (model only has marketValue + gainLoss).

## From Apple Notes (imported 2026-08-10)

## [x] Stale marketing screenshots, FIXED 2026-08-10

**Resolution:** The initial investigation tracked the empty-state issue (Portfolio $0.00, "No transaction data", "No budget data") to the demo account lacking KV seed data, and proposed a dead-end fix approach (manually author demo portfolio JSON). The real solution turned out simpler: the snapshot pipeline was logging into the empty demo account, but the repo's gitignored `.env.accounts.local` file already contained real account credentials. Fixed by running fastlane snapshot with `DEV_EMAIL`/`DEV_PASSWORD` pointing to Joshua's real account. Uncovered two pipeline bugs in the process: (1) `ios/fastlane/Snapfile` was missing `-skipPackagePluginValidation`, causing the SwiftLint SPM build-tool plugin to fail headlessly and timeout (~15s failures, ~8 silent retries per full run); (2) PreviewScreenshot.swift launched the app three times (Portfolio, Settings, Settings again), and the third launch reliably died with "Simulator device failed to launch" timeout, consolidated Settings into Portfolio launch to reduce to two launches, eliminating the timeout. Result: four refreshed screenshots deployed live showing real portfolio data ($162.37, actual holdings, spending chart). Settings screenshot deliberately omitted to keep personal email off the public landing page. Unreferenced PNG duplicates deleted from public/screenshots/. Commit f6b08f8.

## From Apple Notes (imported 2026-08-11)
- [ ] **Needs Joshua: re-upload the June 2026 statement.** Consequence of the month-labelling
  bug above, because July was mislabelled "Jun", the upload handler's dedupe treated it as a
  duplicate of June and *replaced* the June record in KV. The parser fix stops it recurring and
  `refreshStoredStatements` self-heals stored records below `SUMMARY_VERSION` (4), but it cannot
  recover a record that was overwritten. If the June PDF still exists in Blob it may survive as
  an orphan; otherwise just re-upload June, then July, and confirm both now appear as separate
  months.
- [ ] iOS: fix "Login with …" (social sign-in buttons), **blocked, not a code bug.** `server/api/auth.js` already has complete hand-rolled Google (`:202-268`) and Facebook (`:270-329`) flows; `GOOGLE_CLIENT_ID`/`SECRET` are present but empty and `FACEBOOK_CLIENT_ID`/`SECRET` are unset. Needs Joshua to register the apps in Google Cloud Console / Meta for Developers, then set them as Worker secrets (`npx wrangler secret put`). No code change unblocks this.
- [ ] Web landing page needs a light mode (looks great otherwise), note `CLAUDE.md`'s standing rule "Web: dark only (Gotham brand, hardcoded dark surfaces)"; this item contradicts it, so confirm the rule is being retired before implementing.
- [ ] Mac app: thorough end-to-end test pass

> Resume note (2026-08-11), **updated 2026-08-13**: the `wip: partial work from /work notes ingest` commit (`2a46fe9`) has now been reviewed and verified, 413 tests pass, iOS and macOS both BUILD SUCCEEDED. Five of the items above are genuinely done and checked off. The "unpushed" claim in the original note was already stale: `2a46fe9` and `d98e8ce` are both on `origin/main`. Safe to build on.

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

## From Notes (imported 2026-08-27)
- [ ] Widgets receive no data: `widgets-ios/Models/WidgetAPI.swift` reads `UserDefaults(suiteName: "group.com.heyitsmejosh.epiphany")`, but the **main app declares no app-groups entitlement** (only the widget target does) and no main-app code writes that suite. Found while inspecting the signed archive; unrelated to the rejection.


## Portfolio + Markets feedback (2026-09-03)
- [ ] Markets list: add a Buy/Hold/Sell group filter using `Indicators.TradeSignal` (ios/Helpers/Indicators.swift L75); needs per-symbol history so compute lazily/cached. Default sort is already `% Change` (MarketsView.swift L12).

## From Notes (2026-09-12)

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
- [ ] Budget should read income statements dynamically instead of a typed Monthly Income ($1000 shown, real figure is higher); phone device debt should calculate dynamically too. Screenshot: notes/attachments/2026-10-01/epiphany-3.png. 2026-10-01: KV data fixed. Still open: statements can't tell paycheques from card payments, so income from statements needs a deposit/account tag first; phone debt needs a start date and monthly payment (minPayment is 0) before it can count down
- [ ] /api/venue-details returns HTTP 400 from Yelp (key set but rejected, Yelp Fusion went paid). Only the iOS 17 / macOS 14 fallback sheet uses it now; drop it or swap the source

## QA loop 2026-10-01
Pass 1 (simulator, signed in): Map B (emoji pins, dense construction markers), place card A (Look Around nil on simulator only, works on device), Markets B (rows blank in demo, ticker fixed), Portfolio A-, Settings A.
- [ ] Yelp key on Cloudflare returns 400, needs a fresh key from the Yelp developer portal (Chrome job), only adds review photos and ratings
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
- [ ] Watchlist widget shows the user's real watchlist and works on the Lock Screen (vs Apple Stocks widget follows your actual ). ios/Models/AppState.swift:545 loadWatchlist: after `watchlist = try await ...fetchWatchlist()`, write `Array(watchlistSymbols)` to UserDefaults(suiteName: group.com.heyitsmejosh.epiphany) key `widget_watchlist` and call WidgetCenter.shared.reloadTimelines(ofKind: "WatchlistWidget") (kind constant at widgets-ios/Views/WatchlistWidget.swift:5). widgets-ios/Providers/WatchlistProvider.swift:25: replace the hardcoded `de
- [ ] Next earnings date and dividend date on the stock page (vs Wealthsimple Trade shows next earnings d). server/api/stocks-free.js:185 append `,earningsTimestamp,earningsTimestampStart,dividendDate` to the Yahoo v7 fields string; :224 (the q => ({...}) map) add `nextEarnings: q.earningsTimestamp ?? q.earningsTimestampStart ?? null, dividendDate: q.dividendDate ?? null`. ios/Models/Stock.swift: add `let nextEarnings: Double?` and `let dividendDate: Double?` with CodingKeys (:88) and decodeIfPresent in init(from:) (:98). 
- [ ] Instant open: Markets tab renders last known prices on launch, then refreshes (vs Apple Stocks and Yahoo Finance show cach). ios/API/EpiphanyAPI.swift:178 fetchStocks: after `let data = try await perform(request)`, write `data` to FileManager caches dir `stocks.json` (same for fetchCommodities and fetchCrypto). ios/Models/AppState.swift: add `func hydrateCachedMarkets()` that decodes `[Stock]` from that file (reuse the same `decode`), sets `stocks` and `stocksFetchedAt` from the file's modification date only when `stocks.isEmpty`. Call it 
- [ ] Layers button on the map itself: toggle Flights, Traffic, Incidents, Weather, Quakes, Wildfires, AQI without leaving the map (vs Google Maps Layers sheet with Traffic, T). ios/Views/SituationView.swift:772 layerPickerButton is already a Menu of basemap styles; add a second `Section("Layers")` with `Toggle("Flights", isOn: $showFlights)` etc. bound to the nine @AppStorage flags that already exist at :115-124 (SettingsView.swift:649 keeps its copies, same keys). macos/Views/SituationView.swift:564 same Menu, bound to appState.situation*Enabled (the bindings SettingsView.swift:390 sourceB
- [ ] Map that is fast and stays alive: skip the refetch on tiny pans, stop the flight timer when there is nothing to move, honour Low Power Mode, and reload every 5 minutes while the tab is open (vs Google Maps and Apple Maps only re-searc). ios/Views/SituationView.swift: add `@State private var lastLoadedRegion: MKCoordinateRegion?`; in .onMapCameraChange (:687) compute centre delta vs lastLoadedRegion and if it moved under 25% of the previous span and latitudeDelta ratio is within 0.5 to 2, run only refreshVenues and return; set lastLoadedRegion at the end of loadData (:873). :169 flight timer: `guard showFlights, !flights.isEmpty, !ProcessInfo.process
- [ ] First run that is not Joshua's bank account: empty fallbacks plus a three-step 'drop last month's PDF' card (vs Copilot Quick Start Guide and YNAB's Rea). src/config/userProfile.js: empty USER_BUDGET, USER_DEBT, USER_BILLS, USER_TELECOM, USER_SUBSCRIPTIONS, USER_INCOME_PHASES (Welfare, Vape, Weed, Visa $7500, Telus lines, Claude Pro all ship to every signed-out and empty-KV user today via src/utils/financeData.js:2-14 aliasing them as DEMO_* and src/hooks/usePortfolio.js:122-130 falling back to them). src/components/FinancePanel.jsx: delete the Monthly Bills card and T
- [ ] Search any ticker or company name and add it to the watchlist (vs Apple Stocks search returns any symbol b). New server/api/search.js: GET ?q=, calls Yahoo `v1/finance/search?q=&quotesCount=8&newsCount=0` with YAHOO_HEADERS from stocks-shared.js (same unofficial endpoint family stocks-free.js:190 already uses), returns [{symbol, name, exchange, type}], KV cache 10 min keyed by lowercased q. Register in api/gateway.js (import plus the route map at :29 and the cache seconds table at :105). ios/Views/MarketsView.swift:274 bott
- [ ] Web map keeps its last pins and tiles when the network drops (vs Apple Maps offline areas). vite.config.js:64 workbox block: add `runtimeCaching: [ { urlPattern: /basemaps\.cartocdn\.com/, handler: 'StaleWhileRevalidate', options: { cacheName: 'tiles', expiration: { maxEntries: 500, maxAgeSeconds: 7*24*3600 } } }, { urlPattern: /\/api\/(flights|traffic|incidents|earthquakes|weather-alerts|wildfires|aqi|crime|local-events|stocks-free|commodities|crypto)/, handler: 'NetworkFirst', options: { cacheName: 'api',
- [ ] Pin age for earthquakes and weather alerts: '42 min ago' in the sheet and faded pins past 24 h (vs Citizen colour-codes pins by age). Scoped down from the candidate: /api/incidents is an Overpass query for construction sites, police and fire stations, museums and bus stations (server/api/incidents.js:130-172), static map features with no event time, so incident age is not a thing. Real timestamps exist for quakes (server sends `time` epoch ms at earthquakes.js:57; Shared/SituationData.swift:62 already lists `time` as a coding key but only fills the
Bigger, parked:
- [ ] Per-category budget vs actual with an on-track colour, mid-month projection, in the Budget tab and the Budget widget (day, high): budget.expenses lines (src/components/FinancePanel.jsx:1257, server/api/portfolio.js mergeBudget, src/utils/financeData.js validatePortfolioData) have no category key, so first add one and a picker from the statement cat
- [ ] Review queue: 'N rows to sort' card after upload with two suggested categories per row and Mark all reviewed (day, medium): Builds on the rules map from the categorization quick win: suggestions come from the stored rules plus the most common category for similar merchant text. Web card at the top of the spending tab in src/components/Finance
- [ ] Push notifications that fire with the phone in your pocket: price alerts, nearby severe weather, M4+ quakes, wildfires, bill reminders (week, high): Candidates 6, 7 and 15 collapse into one piece of infrastructure. Server: a 5-minute cron (wrangler.jsonc:27 triggers and the path map at worker/index.js:145; today the only data cron is 08:00 weekdays) sweeping Supabase
- [ ] Apple Watch complications for a chosen symbol with price, percent or market cap (day, medium): watchos/project.yml has a single application target and watchos/EpiphanyWatch.xcodeproj has one com.apple.product-type.application; grep for WidgetKit, accessoryCircular, accessoryCorner across watchos returns nothing, s
- [ ] Earnings and dividend dates merged into the Portfolio financial calendar with Add to Calendar (hours, medium): Follow-up to the earnings quick win once nextEarnings is on the Stock model: ios/Views/PortfolioView.swift:555 buildCalendarEvents merges watchlist and holdings earnings dates, StockDetailView gets an EKEvent button. Lis
Dropped on purpose: Copilot-style ML category prediction from amount, weekday and card: a per-user merchant ru; Rocket Money SMS assistant texting you about price increases and new subscriptions: needs ; Watch Duty evacuation orders subscribed by county: requires a regional evacuation-order fe; Citizen-style following an incident from first report to resolved: /api/incidents is an Op; Flightradar24 7700 emergency squawk alerts: needs continuous aircraft polling in the backg; Apple Maps-style full offline area download: MapKit exposes no tile download API and the C

## Ingested 2026-10-02
- [ ] Add the jobs report.

## Ingested 2026-10-16
- [ ] Compare our stocks list against the iOS Stocks app. (screenshot: notes/attachments/2026-10-16/epiphany-2.png)

## Ingested 2026-10-21
- [ ] Login broken after the new domain change. Sign-in sheet sits on a spinner. (screenshot: notes/attachments/2026-10-21/epiphany-1.png) Cause: iOS 2.5.17 calls the dead heyitsmejosh host; 3.0.0 (in review) already uses jaybulb. Web: SITE_URL secret moved to jaybulb 2026-10-21. Left: add https://epiphany.jaybulb.com/api/auth?action=google-callback to Google client 455155642136 (project epiphany-501805) and the github-callback to the GitHub OAuth app. Native Apple and Google buttons go in 3.0.1.
- [ ] [P1] Stale App Store links. (2026-10-21: every epiphany link in code already points at id6779522175, so the stale ones are elsewhere. Which page or app? Need the URL.)
- [ ] [P1] Avatar generation is stale. Should be Greek gods, Hermes style, not dots like Anthropic. (notes/attachments/2026-10-21/epiphany-7.png)
- [ ] [P2] Map: Look Around / Apple Maps street view in the place sheet disappeared, it should be showing. (notes/attachments/2026-10-21/epiphany-4.png)
- [ ] [P2] Map: places render on the map. What other details could we be displaying? (sheet today shows hours, phone, website, address, Get Directions) (notes/attachments/2026-10-21/epiphany-4.png)
- [ ] [P3] Map: for airplanes, use emojis instead of round blue dots. (notes/attachments/2026-10-21/epiphany-5.png) Question: house rule is no emojis in any UI, did you mean a plane glyph without the blue circle, or a real emoji?
- [ ] [P3] Remove Debt & Calendar's calendar unless we can find a use for it. (notes/attachments/2026-10-21/epiphany-6.png)

## QA pass 2026-10-21 (web, iOS)
- [ ] Web map heatmap renders as one opaque red blob over Maple Ridge/Langley. Lower opacity or radius so streets show through.
- [ ] Web mobile has no visible tab bar; Markets, Portfolio and Settings hide behind the burger. Consider a bottom tab bar like iOS.
- [ ] Landing platform line wraps with "Android" orphaned on its own line at 375px.
- [ ] iOS Markets: blank band between the ticker strip and the first row, and the Business News drawer covers the list above the tab bar.
- [ ] iOS Settings signed out is just Sign In and Register on an empty screen. Add the map and appearance sections for signed-out users too.
- [ ] iOS Portfolio monthly subscriptions total adds US$200 to CAD amounts. Convert or show per currency.
