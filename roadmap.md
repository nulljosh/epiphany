# Epiphany Roadmap

## From Epiphany.pdf (imported 2026-07-07)
- [x] Portfolio duplicate accounts — root cause: `server/api/portfolio.js` broker-account
  overlay only filtered out accounts already tagged `source: 'broker'`; legacy rows
  saved to KV before that tag existed had no `source` field, so they were kept as
  "manual" forever while a fresh broker copy got layered on top every GET. Now also
  filters manual accounts by name-collision with the current broker snapshot.
- [x] News drawer thumbnails — `NewsDrawerView.swift` now renders `article.imageUrl`
  (field already existed on `NewsArticle`, was just unused) as a 60x60 AsyncImage.
- [x] Stocks list gains filter — added `gainersOnly` toggle to the Markets `ellipsis.circle`
  menu (`MarketsView.swift`), filters to `changePercent > 0`.
- [x] Google login (web) — DONE 2026-07-07. `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
  set in Vercel production. `server/api/auth.js` has `google`/`google-callback`
  actions, mirrors the GitHub OAuth flow (redirect_uri `/api/auth?action=google-callback`).
  "Sign in/up with Google" buttons live in `LoginPage.jsx` + `RegisterPage.jsx`.
  Verified via `npm run build` — succeeds.
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
- [x] Ticker bar choppy/slow — 2026-07-07: fixed. `TickerBarView.swift`'s
  auto-scroll marquee used `TimelineView(.animation(minimumInterval: 1/60))`
  and rebuilt+reformatted (currency `FormatStyle`) every stock's `Text` on
  every single frame while the Markets tab was open, competing with the
  List's own scroll on the main thread. Now precomputes formatted ticker
  items once on `appState.stocks` change. Also fixed a regression this
  introduced (ticker went blank — EmptyView blocked onAppear from ever
  populating items; seeded synchronously in init instead). Verified live via
  AXe in simulator (ticker content visibly changes frame-to-frame).
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
- [ ] Backend: enrich commodity/crypto endpoints to return day range, prev
  close, 52w range, and (crypto) volume + market cap, then surface in the detail
  stats grid. No-fake-data: only show fields the API actually returns.
- [ ] Derivable now without backend: Period High/Low from the already-loaded
  price history; SMA20/EMA50 overlays on the commodity chart (StockDetailView
  computes these client-side -- reuse). Deferred, needs a chart refactor pass.

## Autopilot simulator visibility (2026-07-05)
- Works but confusing: paper runs only fire hourly DURING market hours.
  Paper-mode BTC fix deployed 2026-07-05.
- [x] Stale live-failed rows hidden from paper log — `AutopilotSection`
  now filters the trade list to the active mode (2026-07-05).
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

## iOS landscape support (deferred 2026-07-09)
Orientation flag enable is one line, but map/markets/portfolio are portrait-first —
enabling without adapting layouts looks broken. Needs a per-screen pass (split
layouts, wider charts, map controls) before flipping. Same applies to other iOS apps.
Also: Holdings "Display metric" row (All time / Today's / Total value) needs
per-holding day-change data from backend — model only has marketValue + gainLoss.

## Stashed 2026-07-10
- [ ] Autopilot copy ("Pilots"): curated famous-investor model portfolios (congress trades + 13F trackers, read-only vs SnapTrade) with performance-vs-you + new-trade alerts; web first, mirror iOS. Feature notes in wiki pages/epiphany.md
