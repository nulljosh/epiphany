# Epiphany Roadmap

## From epiphany-notes.pdf (imported 2026-06-30)
- [ ] Push latest version to App Store — ASC shows only one appStoreVersion (1.0, READY_FOR_SALE) for app 6779522175; verify whether a newer build/marketing version needs submitting before pushing.
- [ ] Splash page: swap old greyscale screenshots — needs new screenshots captured first (asc-screenshot-resize / appstore-screenshots skill).
- [x] Finish roadmap section in README — already present ("Weekend Roadmap" section, links to this file).
- [ ] Refresh architecture.svg (root, ios/, macos/) — currently too basic.
- [ ] Create a skill/shortcut for generating SVG architecture maps.
- [x] Decide on tradingview/ folder — keep; it's original Pine Script ports of Monica's own simulator logic (see `tradingview/README.md`), not a fork of someone else's repo.
- [ ] src/App.jsx: remove hardcoded prices/data, make dynamic.
- [ ] Watchlist: make dynamic instead of static ticker list.
- [ ] Add "Login with TradingView" to sync watchlist.
- [ ] Migrate trade execution to IBKR or Alpaca — Alpaca = easier start, IBKR = more powerful/complex; SnapTrade stays optional for aggregation only.
