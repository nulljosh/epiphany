# Epiphany Roadmap

## From epiphany-notes.pdf (imported 2026-06-30)
- [ ] **MANUAL (Joshua):** Push latest version to App Store — confirmed via `asc builds list`: latest valid iOS build is 2.5.1 (build 6, uploaded 2026-06-28), but only App Store version 1.0 exists (READY_FOR_DISTRIBUTION). A newer version needs creating + submitting. `asc versions create` was blocked by Claude Code's auto-mode classifier as a production-sensitive write requiring explicit user-directed version number + metadata scope — run manually: `asc versions create --app 6779522175 --version "2.5.1" --platform IOS --copy-metadata-from "1.0" --copy-fields "description,keywords,marketingUrl,promotionalText,supportUrl,whatsNew"`, then attach build 6 and submit for review (export compliance question is interactive).
- [x] Splash page screenshots — already current: README.md and LandingPage.jsx both reference the `-new` screenshot set (`screenshot-situation-new.png` etc.), most recently updated 2026-06-28 (situation) and 2026-06-20 (markets/stocks). No greyscale/stale screenshots found referenced anywhere. Note stale.
- [x] Finish roadmap section in README — already present ("Weekend Roadmap" section, links to this file).
- [x] Refresh architecture.svg — root regenerated (white bg, Apple node-and-line style per repo standards, reflects Gateway/Auth/Map/Stocks/KV/Brokerage/Billing/People/Avatar); ios/macos fixed stale "Monica" branding → "Epiphany". Verified valid XML via `python3 -c ET.parse`.
- [ ] Create a skill/shortcut for generating SVG architecture maps.
- [x] Decide on tradingview/ folder — keep; it's original Pine Script ports of Monica's own simulator logic (see `tradingview/README.md`), not a fork of someone else's repo.
- [ ] src/App.jsx: remove hardcoded prices/data, make dynamic.
- [ ] Watchlist: make dynamic instead of static ticker list.
- [ ] Add "Login with TradingView" to sync watchlist.
- [ ] Migrate trade execution to IBKR or Alpaca — Alpaca = easier start, IBKR = more powerful/complex; SnapTrade stays optional for aggregation only.
