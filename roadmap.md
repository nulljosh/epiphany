# Epiphany Roadmap

## iOS 2.5.2 pass (from 2026-07-01 feedback)
- [x] Map search bar restyle + location button cycles 3 zoom levels (2026-07-01)
- [x] ASC version 2.5.2 created (PREPARE_FOR_SUBMISSION), clean What's New set (2026-07-01)
- [x] ASC marketing URL → heyitsmejosh.com (2026-07-01)
- [ ] Fresh App Store + splash screenshots
- [ ] Archive + upload build 2.5.2, then submit (needs screenshots first)
- [x] Portfolio staleness — broker re-sync on refresh (4de273f, 2026-07-01)
- [x] Duplicate ticker in markets drawer removed (4de273f)

## From epiphany-notes.pdf (imported 2026-06-30)
- [ ] Create a skill/shortcut for generating SVG architecture maps.
- [ ] **Needs dedicated session:** src/App.jsx `ASSETS` const (line ~36, ~180 tickers) — already documented as fallback-only ("live prices auto-loaded from Yahoo Finance via useStocks", replaced on load), used in 6+ places across the 978-line file, tightly coupled to the trading simulator. Original PDF itself flagged this under "Bigger Builds (plan before starting)" — not safe to blind-edit in a lean pass; risks breaking the simulator.
- [ ] **Needs dedicated session:** Watchlist dynamic — same file/coupling risk as above, do together with the ASSETS refactor.
- [ ] **BLOCKED (Joshua):** Add "Login with TradingView" to sync watchlist — no public TradingView API for reading a user's watchlist/account (already investigated 2026-06-21 in CLAUDE.md). Only real path: TradingView Pro+ outbound webhook alerts via a new `/api/tradingview/webhook` endpoint — needs Joshua's TradingView Pro+ account to configure webhooks, can't self-provision.
- [ ] **BLOCKED (Joshua):** Migrate trade execution to IBKR or Alpaca — needs live brokerage API keys/account credentials from Joshua; Alpaca = easier start, IBKR = more powerful/complex. SnapTrade stays optional for aggregation only.
