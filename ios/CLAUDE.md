# Epiphany iOS

v100.0.0. iPhone app with four tabs (Situation, Markets, Portfolio, Settings), portrait only, follows system light and dark. API: epiphany.jaybulb.com. Shared Swift lives in `../Shared`.

## Run

```bash
xcodegen generate
xcodebuild -project Epiphany.xcodeproj -scheme Epiphany -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -skipPackagePluginValidation build
xcodebuild test -project Epiphany.xcodeproj -scheme Epiphany -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -skipPackagePluginValidation
```

`-skipPackagePluginValidation` is required on every CLI build: SwiftLint runs as an SPM plugin and its trust prompt can't be answered headless.

Debug builds sign in on their own from `Configs/Secrets.xcconfig` (gitignored, `DEV_EMAIL` and `DEV_PASSWORD`, escape `$` as `$$`). A fresh clone needs that file before `xcodegen generate`. Never put credentials in `project.yml` or the scheme.

QA launch arguments: `-qaTab N` opens on a tab, `-qaStock AAPL` opens a stock's page, `UITEST_DEMO` uses demo data.

## Rules

- iPhone only, portrait, `UIRequiresFullScreen`.
- The map is home and never jumps on load.
- Launch loads stocks, crypto, commodities, finance and Fear & Greed in parallel, behind the splash.
- Sessions survive relaunch (cookie plus keychain).
- Colours come from `Palette`, which adapts to light and dark. No `preferredColorScheme` lock except the user's own theme setting.
- No emojis, except the ✈️ flight markers Joshua asked for. Plain SF type, no rounded design.

## Key files

- `Views/SituationView.swift`: the map, its layers, venue search, Look Around and drive time.
- `Views/MarketsView.swift`: Markets list, index cards and movers (`Shared/MarketPulse.swift`), crypto and commodity detail with full-screen chart.
- `Views/StockDetailView.swift`: stock detail, indicators, scrub, full-screen chart.
- `Views/PortfolioView.swift`: spending, holdings, budget, statements.
- `Services/AlertWatcher.swift`: background refresh that fires price alerts with the app closed.
- `API/EpiphanyAPI.swift`: every request. `fetchPriceHistory` maps display ranges to Yahoo range and interval.
- `WhatsNewCard.swift`: three short bullets per release; the version comes from the bundle.

Version lives in `project.yml` (`MARKETING_VERSION`). On a release, match the README badges and the first line of this file.
