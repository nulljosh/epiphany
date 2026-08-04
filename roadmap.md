# Epiphany Roadmap

## From Notes PDF (imported 2026-08-02)
- [ ] "Coolest app ever" — explore an unnamed app/website's idea and integrate it into Epiphany (from Coolest app ever.pdf note). Note is underspecified — no site name or screenshot came through in the export; ask Joshua which app/site this refers to before scoping.

## Now (from README)
- Statement upload UI — file not persisting on upload
- News not loading (`fetchNews()` / backend news endpoint)
- Per-stock news drawer on `StockDetailView`

## Next (from README)
- Mac + watchOS App Store submission checklist (compliance answers, support URL)
- Autopilot: first live BTC probe fill (capped at 3 fractional trades, auto-reverts to paper) — runs on Alpaca (paper by default); Wealthsimple/RBC stay read-only (no public trading API). Needs `ALPACA_API_KEY` + `ALPACA_API_SECRET` in Vercel to go live.

## Landing page pass (imported 2026-07-21)
- [ ] Markets news drawer drag — see consolidated "still choppy" entry below (Epiphany.pdf section); this is attempt #3, also failed, also reverted.
- [ ] **Brand identity pass (raised by Josh, not started)** — iOS/macOS/web all lean entirely on default Apple styling: `Palette.appleBlue` tint everywhere, SF Symbols only, no signature color or typography distinct from any other SwiftUI app. The landing page's Fraunces serif headline is the only existing brand asset and doesn't extend into the apps themselves. Cheap high-impact ideas floated: (1) one signature accent color to replace `.appleBlue` app-wide (no gradients/purple per standing UI rules); (2) reuse Fraunces for in-app section headers, not just marketing copy; (3) a custom map style/pin set — now that native Apple POI pins are off (see map pins fix above), the map (home screen on both iOS/macOS) is the biggest available differentiation surface. Needs its own dedicated design session, not a rushed pass.

## From Epiphany.pdf (imported 2026-07-07)
- [ ] **Markets news drawer drag still choppy — NOT actually fixed despite two
  attempted fixes 2026-07-07.** User confirmed live on-device 2026-07-07 late:
  still not as fluid as native iOS Stocks. Attempt 1 (build-verified only, never
  tested live): moved the drawer's `.frame(height:)` off directly resizing the
  `List` inside `NewsDrawerView` every drag pixel — content now fixed at max
  height, only an outer clip animates (`MarketsView.swift` `newsDrawerOverlay`).
  This was a real perf issue but apparently not the (or not the only) cause of
  the felt choppiness. Next session: do NOT guess again — get the user to
  describe *specifically* what feels wrong (lag following the finger? jank on
  release/spring settle? stutter only during momentum flicks? frame drops only
  with news images loading?) before touching code. Consider also: `.ultraThinMaterial`
  background + `.shadow` recomposited every drag frame (still true even after
  the List fix), the `.spring(response: 0.35, dampingFraction: 0.82)` settle
  animation itself, or main-thread contention from the 30s refresh timer /
  concurrent data loads while dragging. Test with Instruments Time Profiler on
  a real device, not just xcodebuild success, before claiming fixed again.
  Row padding vs. native is a separate cosmetic-only gap, already addressed
  2026-07-07 (star gutter 18→14pt, row padding 6→4pt) but not re-verified live.
- [ ] **Attempt 3 (2026-07-22), also failed — reverted, commit `69f82c6`.** Tried
  replacing the per-drag `.frame(height:)` resize with a constant-size frame
  slid via `.offset(y:)` (a pure compositor transform, no relayout — the
  textbook fix for this exact SwiftUI pattern, matches the blog post Josh
  linked). Never tested live before claiming done (repeated the exact mistake
  this roadmap already warned against above). Josh tested it live: the drag
  handle's hit-test region no longer tracked the visible drawer — dragging
  passed through to the stock row underneath instead of moving the drawer.
  Reverted back to the frame-resize version (choppy but responsive) same
  session. Root cause theory for why offset broke hit-testing: the drag
  handle overlay is attached via `.overlay(alignment: .top)` to the
  *offset-shifted* view, and the view's own layout frame stays fixed size
  (maxHeight) regardless of drag state — only `.offset()` moves it visually.
  SwiftUI's hit-testing should account for ancestor offsets, but something in
  this specific chain (offset → padding → overlay → clipped, in that order)
  desynced the touch target from the rendered position. Next attempt: test the
  offset approach in isolation on a fresh dummy view first to confirm it's
  even viable in this SwiftUI version before wiring it into the real drawer,
  or try attaching the `DragGesture` to a sibling view with a stable
  (non-offset) frame instead of the offset-shifted card itself. Still needs:
  ask Josh exactly what feels wrong (lag vs. stick vs. jump-on-release) and
  Instruments Time Profiler on a real device — neither has happened across
  all three attempts.

## iOS 2.5.2 pass (from 2026-07-01 feedback)
- [ ] Fresh screenshots (fastlane snapshot erroring, exit 75) — optional, 2.5.1 shots carry over

## iOS Markets drawer polish (2026-07-05)
- [ ] Mirror Yahoo Finance layout: when the news drawer is at `.large`, the
  top horizontal-scrolling ticker (`TickerBarView`, already pinned via
  `.safeAreaInset(.top)` in `MarketsView.swift`) should own ~top 10% of the
  view. Structure already exists (drawer `.large` = 0.85 height leaves ~15%
  top gap); this is a visual-proportion tuning pass — do it live on the sim,
  not blind. Consider gating/emphasizing the ticker specifically at `.large`.

## iOS commodity/crypto detail parity (2026-07-05)
- News + chart + range picker already work for commodities/crypto
  (`MarketItemDetailView`). The sparse "little data" look is a DATA gap, not UI:
  `CommodityData` carries only name/price/change/changePercent and `CryptoData`
  only symbol/spot/chgPct -- there are no stats to show (no volume/range/mktcap).
- [ ] Backend DONE 2026-07-19: commodities now return dayHigh/dayLow/prevClose
  (52w already there); crypto returns high24h/low24h (volume + market cap already
  there). Web stats grid surfaced 2026-07-19 (StockDetail fallbacks). Remaining: iOS/macOS mirror.
  No-fake-data: only show fields the API actually returns.
  Checked 2026-07-21: bigger than a mirror pass — no iOS/macOS view currently
  renders `CommodityData`/`CryptoData` at all (`ios/Views/StockDetailView.swift`
  is equity-only, no NavigationLink from Markets rows to a commodity/crypto
  detail found). Needs a dedicated session: build the detail view first, then
  add the stats fields.
- [ ] Derivable now without backend: Period High/Low from the already-loaded
  price history; SMA20/EMA50 overlays on the commodity chart (StockDetailView
  computes these client-side -- reuse). Deferred, needs a chart refactor pass.

## Autopilot simulator visibility (2026-07-05)
- Works but confusing: paper runs only fire hourly DURING market hours.
  Paper-mode BTC fix deployed 2026-07-05.
- [ ] Live trading remains blocked on a trade-permissioned brokerage (Alpaca
  easiest) -- SnapTrade/Wealthsimple is read-only by design.

## SnapTrade Trade tab (2026-07-05)
- [ ] **Needs Joshua:** phantom-holdings dedupe shipped 2026-07-02; re-enable
  the disabled Trade tab in `FinancePanel.jsx` after Josh eyeballs a real
  force-sync to confirm holdings/math are clean.

## From epiphany-notes.pdf (imported 2026-06-30)
- [ ] **Needs dedicated session:** src/App.jsx `ASSETS` const (line ~36, ~180 tickers) — already documented as fallback-only ("live prices auto-loaded from Yahoo Finance via useStocks", replaced on load), used in 6+ places across the 978-line file, tightly coupled to the trading simulator. Original PDF itself flagged this under "Bigger Builds (plan before starting)" — not safe to blind-edit in a lean pass; risks breaking the simulator.
- [ ] **Needs dedicated session:** Watchlist dynamic — same file/coupling risk as above, do together with the ASSETS refactor.
- [ ] **BLOCKED (Joshua):** Add "Login with TradingView" to sync watchlist — no public TradingView API for reading a user's watchlist/account (already investigated 2026-06-21 in CLAUDE.md). The receiving endpoint already exists — `server/api/broker/webhook.js` (registered as `broker/webhook` in `api/gateway.js`) accepts `{ticker, action, qty}` and places an Alpaca paper order, logging when `ALPACA_API_KEY` isn't set. Only remaining step needs Joshua's TradingView Pro+ account to configure an outbound webhook alert pointing at it — can't self-provision.
- [ ] **BLOCKED (Joshua):** Migrate trade execution to IBKR or Alpaca — needs live brokerage API keys/account credentials from Joshua; Alpaca = easier start, IBKR = more powerful/complex. SnapTrade stays optional for aggregation only.
  Researched 2026-07-22: IBKR does NOT bridge to Wealthsimple — SnapTrade/Wealthsimple
  is read-only by design (confirmed, no official trade API), and the only way to
  execute trades *in a Wealthsimple account* is via unofficial reverse-engineered
  wrappers (github.com/ahmedsakr/wstrade-api, github.com/mdy405/ws-auto-trade) that
  violate WS's ToS (risk of account ban) — not viable for a real product. Real path:
  trade execution happens in a separate IBKR or Alpaca account (not Wealthsimple),
  with SnapTrade/WS staying read-only for portfolio display. Alpaca has the simplest
  REST API for this. Claude/TradingView-MCP repos exist for chart analysis + signal
  generation (e.g. github.com/tradesdontlie/tradingview-mcp) but don't solve the
  Wealthsimple execution gap — TradingView has no public API to read a user's
  watchlist either, only outbound Pro+ webhook alerts (already logged as blocked
  above). Bottleneck is brokerage choice + funded account, not integration code.
  **Needs Joshua 2026-07-22:** sign up for Alpaca (paper trading account, free,
  fastest path — do this first) at alpaca.markets. IBKR only if TSX/Canadian
  equities are needed later (heavier KYC/setup). RBC confirmed no public trading
  API, not viable regardless. Can't be automated — requires identity verification,
  can't reuse a password across sites. Once Alpaca API keys exist, wire into
  epiphany's autopilot execution leg (see `broker/morning-run.js`).

## iOS landscape support (deferred 2026-07-09)
Orientation flag enable is one line, but map/markets/portfolio are portrait-first —
enabling without adapting layouts looks broken. Needs a per-screen pass (split
layouts, wider charts, map controls) before flipping. Same applies to other iOS apps.
Also: Holdings "Display metric" row (All time / Today's / Total value) needs
per-holding day-change data from backend — model only has marketValue + gainLoss.

## From Merge status.pdf (imported 2026-07-21)
- [ ] Old orphaned "Epiphany Mac" app record (6782703473, bundle `com.heyitsmejosh.epiphany-macos`) needs Joshua's manual ASC dashboard deletion (no public API to delete an app record — confirmed again tonight on Talli's/Echo's equivalent orphaned records). Do not upload anything further to it.

## Stashed 2026-07-10
- [ ] Autopilot copy ("Pilots"): curated famous-investor model portfolios (congress trades + 13F trackers, read-only vs SnapTrade) with performance-vs-you + new-trade alerts; web first, mirror iOS. Feature notes in wiki pages/epiphany.md

## From Epiphany.pdf (imported 2026-07-19)
- [ ] Stocks not syncing properly — "we have no stocks", screenshot displays stale data. Verified 2026-07-21: the manual/broker dedupe fix (`server/api/portfolio.js` line ~97) is still in place and correct, so this is NOT that same bug. STILL BLOCKED 2026-07-26: `server/api/broker/sync.js` has a legitimate 25-min snapshot cache (line 31) that could look like "stale" under normal use, but confirming an actual sync failure needs live SnapTrade logs/account state — no repro available without Joshua's account.
- [ ] Portfolio/Settings tab audit: getting cluttered, decide what stays. Specifically called out: calendar view feels unnecessary — consider removing.
- [ ] Landing page screenshots must use a real populated account, not a created-on-the-fly demo account — demo account currently renders an empty portfolio, which looks broken on the marketing site.
- [ ] Autopilot trading feature isn't implemented yet — hide/gate it in the UI until it ships (currently visible but non-functional). NOTE 2026-07-20: ambiguous against other roadmap sections describing a working paper-trading autopilot (`server/api/broker/morning-run.js`, `AutopilotSection`) — unclear which specific UI surface this refers to (a "live" toggle? a separate unshipped feature?). Needs Joshua to clarify which control is misleadingly visible before hiding anything. RECONFIRMED BLOCKED 2026-07-25: autopilot is fully implemented across `server/api/broker/{autopilot,morning-run,impact-test}.js`, `gates.js`, `src/config/features.js`, `TradeWorkflow.jsx`, `Settings.jsx` — paper mode works, only *live* execution is blocked (read-only brokerage, 403 code 3007). Nothing here is visibly non-functional, so there is no safe surface to hide without Joshua naming the control.

## Ingested 2026-07-25
- [ ] Add a "buy/sell/hold" badge on each stock in Markets as a tappable button opening a sources modal — every claim in the app should be traceable back to why (ontological traceability).

## From Epiphany.pdf (imported 2026-07-28)
- [ ] macOS has no statement upload UI at all — `macos/` contains `Models/Statement.swift` and the `EpiphanyAPI` client methods, but no `NSOpenPanel`/`fileImporter`, no StatementManager view, nothing wired into `macos/Views/PortfolioView.swift`. Web and iOS both upload; Mac can only read whatever the other two uploaded. Port `StatementManagerSheet` from `ios/Views/PortfolioView.swift` (the 2026-07-28 fixed version) — same 4MB guard, statement-driven list, real alert binding. Cross-platform-parity gap, not a regression.
- [ ] Statement storage still lives in Upstash KV as base64 in `server/api/statements.js`, guarded only by a 4MB client-side pre-check on web + iOS. Real fix is migrating to Vercel Blob (same pattern as `server/api/avatar.js`) so large multi-page bank statements stop being a size-limit problem at all.

## Ship 2.5.4 — finish (stopped at usage cap 2026-07-28)
Build `202607281341` (v2.5.4) was archived, exported and **uploaded to ASC** — it was still
processing on Apple's side when this session hit the usage cap. Nothing is submitted yet.
Contains the iOS statement-upload fix (97e612e).

- [ ] Confirm the build finished processing:
      `asc builds list --app 6779522175` → look for build `202607281341`, state VALID
- [ ] Set What's New (no version numbers/emojis):
      `asc versions localizations update --app 6779522175 --version 2.5.4 --locale en-US --whats-new "Uploading a bank or credit card statement now works properly. Previously you could pick a file and nothing would happen, with no error shown."`
- [ ] Attach build + mark encryption + submit:
      `asc builds update --build-id <BUILD_ID> --uses-non-exempt-encryption false`
      `asc review submit --app 6779522175 --version 2.5.4 --build <BUILD_ID> --confirm`

Note: `.asc/workflow.json` needed three flag fixes to archive headlessly at all — see the
commit. macOS was deliberately NOT bumped (still 2.5.2); the statement-upload fix is iOS-only
and macOS has no statement upload UI.

## From App Store.pdf (imported 2026-07-29)
- [ ] Icon still reads generic/weak on ASC — do the promised personality refresh (repeatedly deferred, do it this pass).

## Ingested 2026-08-04
- [ ] Icon still bad and has not been updated in App Store — refresh and ship
- [x] Remove or hide paper trading sim (does nothing / does not work) — 2026-08-04: `AutopilotSection()` call sites commented out in `ios/Views/SettingsView.swift` and `macos/Views/PortfolioView.swift`; web's Trade tab was already disabled in `FinancePanel.jsx`. The section itself is kept, not deleted — uncomment to restore once a brokerage with real trade permission exists (SnapTrade/Wealthsimple is read-only by design). Both platforms build clean.
- [ ] Statement uploading still broken — user reports it still fails as of 2026-08-04, *after* the 2026-07-28 iOS fix (commit 97e612e, which fixed four converging bugs: wrong state array read, no-op success path when financeData was nil, `.constant()` error binding swallowing the alert, and a hard-bail on `startAccessingSecurityScopedResource()` returning false). So either that fix regressed, didn't cover the real path, or the failure is server-side in the parse/upload endpoint. Needs a repro with a real statement PDF before editing anything. Note also: macOS still has no statement upload UI at all (parity gap).
- [x] Business news bottom drawer: hide loading spinner unless drawer is open/expanded (UI bump) — 2026-08-04: `NewsDrawerView` gained an `isExpanded` flag; `MarketsView` passes `drawerState != .peek`. At peek the drawer is clipped to 64pt so the centered spinner poked out as a stray circle.
- [ ] Map search bar needs autocomplete — iOS map search is `MKLocalSearch` in `ios/Views/SituationView.swift` (venue category chips). Wants as-you-type suggestions; `MKLocalSearchCompleter` is the native fit. Mirror to macOS + web when done.
- [x] Debt area and calendar in portfolio stick out — not core features, move them elsewhere or de-emphasize — 2026-08-04: iOS only (web + macOS already scope debt to its own tab). `debtBreakdownSection` + `financialCalendarContent` pulled out of the main scroll and `planningCard`, now in a collapsed "Debt & Calendar" `DisclosureGroup` at the bottom, below subscriptions. Portfolio now reads balance → accounts → spending → holdings → budget → subscriptions.
