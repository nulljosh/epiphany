# Epiphany Roadmap

## From epiphany-notes.pdf (imported 2026-06-30)
- [x] Push latest version to App Store — version 2.5.1 (build 6) created, export compliance answered, build attached, What's New (en-CA) filled, submitted for review via `asc` CLI + Joshua confirming submit. 2026-06-30.
- [x] Splash page screenshots — already current: README.md and LandingPage.jsx both reference the `-new` screenshot set (`screenshot-situation-new.png` etc.), most recently updated 2026-06-28 (situation) and 2026-06-20 (markets/stocks). No greyscale/stale screenshots found referenced anywhere. Note stale.
- [x] Finish roadmap section in README — already present ("Weekend Roadmap" section, links to this file).
- [x] Refresh architecture.svg — root regenerated (white bg, Apple node-and-line style per repo standards, reflects Gateway/Auth/Map/Stocks/KV/Brokerage/Billing/People/Avatar); ios/macos fixed stale "Monica" branding → "Epiphany". Verified valid XML via `python3 -c ET.parse`.
- [ ] Create a skill/shortcut for generating SVG architecture maps.
- [x] Decide on tradingview/ folder — keep; it's original Pine Script ports of Monica's own simulator logic (see `tradingview/README.md`), not a fork of someone else's repo.
- [ ] **Needs dedicated session:** src/App.jsx `ASSETS` const (line ~36, ~180 tickers) — already documented as fallback-only ("live prices auto-loaded from Yahoo Finance via useStocks", replaced on load), used in 6+ places across the 978-line file, tightly coupled to the trading simulator. Original PDF itself flagged this under "Bigger Builds (plan before starting)" — not safe to blind-edit in a lean pass; risks breaking the simulator.
- [ ] **Needs dedicated session:** Watchlist dynamic — same file/coupling risk as above, do together with the ASSETS refactor.
- [ ] **BLOCKED (Joshua):** Add "Login with TradingView" to sync watchlist — no public TradingView API for reading a user's watchlist/account (already investigated 2026-06-21 in CLAUDE.md). Only real path: TradingView Pro+ outbound webhook alerts via a new `/api/tradingview/webhook` endpoint — needs Joshua's TradingView Pro+ account to configure webhooks, can't self-provision.
- [ ] **BLOCKED (Joshua):** Migrate trade execution to IBKR or Alpaca — needs live brokerage API keys/account credentials from Joshua; Alpaca = easier start, IBKR = more powerful/complex. SnapTrade stays optional for aggregation only.
