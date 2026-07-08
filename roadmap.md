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
- [ ] Login SSO buttons "not set up" — Google/Facebook buttons in `LoginSheet.swift`
  are `.disabled(true)` stubs. Root cause: `server/api/auth.js` has zero Google/Facebook
  OAuth handlers (only `github`/`github-callback` exist, fully working — same pattern
  to copy). **Needs Joshua**: register a Google Cloud OAuth client (console.cloud.google.com
  → APIs & Services → Credentials) and/or a Facebook Developer app
  (developers.facebook.com/apps), get client ID + secret for each, add as Vercel env
  vars (`GOOGLE_CLIENT_ID`/`SECRET`, `FACEBOOK_CLIENT_ID`/`SECRET`). Once provided,
  backend wiring is a direct copy of the existing `github`/`github-callback` actions
  (~30min each) plus enabling the matching iOS buttons. Apple Sign In already works,
  no blocker there.
- [ ] Markets drawer choppy/slow load/padding/horizontal-scroll vs native Stocks app —
  CLAUDE.md already logged a 2026-07-05 fix for drawer drag choppiness (removed
  fighting `.animation` vs `@GestureState`). PDF feedback may predate that fix or be a
  regression; needs a live side-by-side sim comparison against native Stocks (padding
  audit + horizontal ticker scroll feel) before further changes — not done this pass.

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
