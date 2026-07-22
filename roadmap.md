# Epiphany Roadmap

## Landing page pass (imported 2026-07-21)
- [x] Landing page Paid tier didn't charge — FIXED same session (commit `cdbf27f`): "Get Epiphany" on the Paid card called the same handler as Free. Now sets a pendingPlan flag and opens the existing (working) Stripe checkout flow post-auth. `src/App.jsx`, `src/pages/LandingPage.jsx`. Not yet manually clicked through end-to-end against Stripe test mode.
- [x] Landing page screenshots refreshed with the real account — FIXED same session: rebuilt in Simulator with dev auto-login (real account, Langley BC location via `xcrun simctl location`), captured Situation tab. `public/screenshots/screenshot-situation-new.png` replaced. Markets/Portfolio/Settings screenshots NOT captured — in-sim tab navigation via AppleScript coordinate clicks proved too unreliable (no AXe tap tool enabled in this environment's XcodeBuildMCP config) and cost too much of the session; redo with a real tap tool or manual capture.
- [ ] Markets news drawer drag — see consolidated "still choppy" entry below (Epiphany.pdf section); this is attempt #3, also failed, also reverted.
- [x] Venue detail modal (Yelp photos/reviews) photo getting cut off — FIXED same session (commit `f907eb2`): `VenueDetailSheet` had no `ScrollView`, so content (Look Around preview, Yelp photos, reviews) overflowed the sheet's `.fraction(0.4)` detent and got clipped. Wrapped the scrollable content, kept "Get Directions" pinned at the bottom. Confirmed live by Josh across multiple venues (Camy's Pizza, Riders Liquor Store) — modal scrolls correctly now, photo no longer cut off.
- [x] Map pins: red pin vs. category icon — FIXED and CONFIRMED LIVE (commit `bddcef0`). Root cause confirmed: schools were never in `server/api/local-events.js`'s Overpass query (`amenity` allowlist didn't include school/university/college) — the red pin Josh originally saw was Apple's own built-in MapKit POI marker, unrelated to any of our custom layers. Fix: (1) added school/university/college to the Overpass query, tagged as a new `education` category; (2) excluded Apple's native POI pins from every map style (`pointsOfInterest: .excludingAll`) on both iOS and macOS `SituationView.swift`, so only our own data layers ever draw a pin. Confirmed live: school now shows with a graduation-cap icon and full detail sheet (About/Source/Lat/Long, Wikipedia-sourced).
- [x] Cross-platform mirror pass — same session: macOS `SituationView.swift` got the same `pointsOfInterest: .excludingAll` + category-keyed local-event emoji (mapPin helper) as iOS. Web (`LandingPage.jsx`/`App.jsx` pricing fix) already covered earlier same session. Build-verified on both iOS Simulator and macOS.
- [x] Portfolio tab hidden until signed in + Settings gets a Register button — FIXED same session. `ContentView.swift`: Portfolio tab (both the `TabView` page and the `FloatingTabBar` icon) only renders when `appState.isLoggedIn`; auto-bounces back to Situation if the user signs out while on Portfolio. `SettingsView.swift`: added a "Register" button next to "Sign In" that opens `LoginSheet` pre-set to register mode (`LoginSheet(startInRegisterMode:)`, new `AppState.showLoginInRegisterMode` flag). Confirmed live by Josh — Register button opens the registration form correctly (Create Account, Apple/Google/Facebook options, "Already have an account? Sign In" toggle). macOS/web equivalent NOT yet done — macOS Settings/tab-bar structure differs (5 tabs, no floating bar) and wasn't touched this pass.
- [x] Sign in with Apple button did nothing — FIXED same session. Root cause: `ios/Epiphany.entitlements` was an empty `<dict/>` (no `com.apple.developer.applesignin` key) and the App ID (`com.heyitsmejosh.epiphany`, `8QHAV87C9U`) had zero capabilities enabled in App Store Connect. Added the entitlement locally and enabled the `APPLE_ID_AUTH` capability via `asc bundle-ids capabilities add --bundle 8QHAV87C9U --capability APPLE_ID_AUTH --settings '[{"key":"APPLE_ID_AUTH_APP_CONSENT","options":[{"key":"PRIMARY_APP_CONSENT","enabled":true}]}]'`. Backend (`server/api/auth.js` `signin-apple` action) was already fully implemented — this app uses its own KV-based auth, not Supabase, so no dashboard provider toggle needed (unlike other apps in the fleet). **Caveat**: editing `Epiphany.entitlements` directly got silently reset to empty by something in the build/xcodegen pipeline once mid-session — re-applied and it held on the second attempt, but if it goes empty again, check whether `xcodegen generate` or a lint/format hook is stomping it before assuming the fix regressed.
- [ ] **Brand identity pass (raised by Josh, not started)** — iOS/macOS/web all lean entirely on default Apple styling: `Palette.appleBlue` tint everywhere, SF Symbols only, no signature color or typography distinct from any other SwiftUI app. The landing page's Fraunces serif headline is the only existing brand asset and doesn't extend into the apps themselves. Cheap high-impact ideas floated: (1) one signature accent color to replace `.appleBlue` app-wide (no gradients/purple per standing UI rules); (2) reuse Fraunces for in-app section headers, not just marketing copy; (3) a custom map style/pin set — now that native Apple POI pins are off (see map pins fix above), the map (home screen on both iOS/macOS) is the biggest available differentiation surface. Needs its own dedicated design session, not a rushed pass.

## From Epiphany.pdf (imported 2026-07-07)
- [ ] Facebook login (web) — same pattern as Google, blocked on **Joshua**: create a
  Meta for Developers app (developers.facebook.com/apps → Create App → Consumer →
  Facebook Login product), copy App ID + secret from Settings → Basic, send over.
  Then: add `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` to Vercel, add
  `facebook`/`facebook-callback` actions to `auth.js` (Graph API OAuth,
  `https://www.facebook.com/v19.0/dialog/oauth` + `https://graph.facebook.com/v19.0/oauth/access_token`),
  add "Sign in with Facebook" buttons. ~30min once credentials exist. Note: Meta
  keeps new apps in "Development mode" (only you + added testers can log in)
  until App Review is submitted for public use.
- [ ] iOS Google/Facebook buttons — `LoginSheet.swift` still has them `.disabled(true)`.
  iOS has no GitHub login either (Apple Sign In is the only working iOS SSO) — the
  web OAuth flow above doesn't cover native. Cheapest path: open the same
  `/api/auth?action=google` web URL in an `ASWebAuthenticationSession` from iOS and
  let the session cookie carry over, rather than integrating the native Google
  Sign-In SDK. Not started.
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
- [ ] Create a skill/shortcut for generating SVG architecture maps.
- [ ] **Needs dedicated session:** src/App.jsx `ASSETS` const (line ~36, ~180 tickers) — already documented as fallback-only ("live prices auto-loaded from Yahoo Finance via useStocks", replaced on load), used in 6+ places across the 978-line file, tightly coupled to the trading simulator. Original PDF itself flagged this under "Bigger Builds (plan before starting)" — not safe to blind-edit in a lean pass; risks breaking the simulator.
- [ ] **Needs dedicated session:** Watchlist dynamic — same file/coupling risk as above, do together with the ASSETS refactor.
- [ ] **BLOCKED (Joshua):** Add "Login with TradingView" to sync watchlist — no public TradingView API for reading a user's watchlist/account (already investigated 2026-06-21 in CLAUDE.md). Only real path: TradingView Pro+ outbound webhook alerts via a new `/api/tradingview/webhook` endpoint — needs Joshua's TradingView Pro+ account to configure webhooks, can't self-provision.
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

## From Icons.pdf / Asc.pdf (imported 2026-07-12)
- [ ] Epiphany Mac 1.0 PREPARE_FOR_SUBMISSION — build, screenshots, metadata, submit

## From Epiphany.pdf (imported 2026-07-19)
- [ ] News drawer slide up/down animation is choppy/glitchy — needs smoothing (likely animation curve/frame drop issue, not a data issue).
- [ ] Stocks not syncing properly — "we have no stocks", screenshot displays stale data. Verified 2026-07-21: the manual/broker dedupe fix (`server/api/portfolio.js` line ~97) is still in place and correct, so this is NOT that same bug — needs fresh investigation (check SnapTrade sync status/logs for the affected account).
- [ ] Portfolio/Settings tab audit: getting cluttered, decide what stays. Specifically called out: calendar view feels unnecessary — consider removing.
- [ ] Landing page screenshots must use a real populated account, not a created-on-the-fly demo account — demo account currently renders an empty portfolio, which looks broken on the marketing site.
- [ ] Autopilot trading feature isn't implemented yet — hide/gate it in the UI until it ships (currently visible but non-functional). NOTE 2026-07-20: ambiguous against other roadmap sections describing a working paper-trading autopilot (`server/api/broker/morning-run.js`, `AutopilotSection`) — unclear which specific UI surface this refers to (a "live" toggle? a separate unshipped feature?). Needs Joshua to clarify which control is misleadingly visible before hiding anything.
