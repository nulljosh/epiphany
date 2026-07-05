# Epiphany Roadmap

## iOS 2.5.2 pass (from 2026-07-01 feedback)
- [x] Map search bar restyle + location button cycles 3 zoom levels (2026-07-01)
- [x] ASC version 2.5.2 created (PREPARE_FOR_SUBMISSION), clean What's New set (2026-07-01)
- [x] ASC marketing URL → heyitsmejosh.com (2026-07-01)
- [x] Build 7 (2.5.2) uploaded to ASC 2026-07-01 after 2 widget-plist fixes. Remaining: wait for processing, attach to 2.5.2, submit via asc.
- [ ] Fresh screenshots (fastlane snapshot erroring, exit 75) — optional, 2.5.1 shots carry over
- [x] Portfolio staleness — broker re-sync on refresh (4de273f, 2026-07-01)
- [x] Duplicate ticker in markets drawer removed (4de273f)

## iOS Markets drawer polish (2026-07-05)
- [x] Drawer drag smoothness + liquid-glass (.ultraThinMaterial) — 9004318
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
- Works but confusing: paper runs only fire hourly DURING market hours, and the
  Recent-trades log still shows stale "live failed" rows from old read-only
  Wealthsimple live-probe attempts (403). Paper-mode BTC fix deployed 2026-07-05.
- [ ] Clear/segregate stale live-failed trades from the paper log, or label the
  log by mode so "simulator" only shows paper fills.
- [ ] Live trading remains blocked on a trade-permissioned brokerage (Alpaca
  easiest) -- SnapTrade/Wealthsimple is read-only by design.

## From epiphany-notes.pdf (imported 2026-06-30)
- [ ] Create a skill/shortcut for generating SVG architecture maps.
- [ ] **Needs dedicated session:** src/App.jsx `ASSETS` const (line ~36, ~180 tickers) — already documented as fallback-only ("live prices auto-loaded from Yahoo Finance via useStocks", replaced on load), used in 6+ places across the 978-line file, tightly coupled to the trading simulator. Original PDF itself flagged this under "Bigger Builds (plan before starting)" — not safe to blind-edit in a lean pass; risks breaking the simulator.
- [ ] **Needs dedicated session:** Watchlist dynamic — same file/coupling risk as above, do together with the ASSETS refactor.
- [ ] **BLOCKED (Joshua):** Add "Login with TradingView" to sync watchlist — no public TradingView API for reading a user's watchlist/account (already investigated 2026-06-21 in CLAUDE.md). Only real path: TradingView Pro+ outbound webhook alerts via a new `/api/tradingview/webhook` endpoint — needs Joshua's TradingView Pro+ account to configure webhooks, can't self-provision.
- [ ] **BLOCKED (Joshua):** Migrate trade execution to IBKR or Alpaca — needs live brokerage API keys/account credentials from Joshua; Alpaca = easier start, IBKR = more powerful/complex. SnapTrade stays optional for aggregation only.
