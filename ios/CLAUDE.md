# Epiphany iOS

v2.5.2 — Native iPhone intelligence app. 4-tab SwiftUI app (Situation, Markets, Portfolio, Settings), portrait-only, auto light/dark. API: epiphany.heyitsmejosh.com

## Dev auto-login (2026-07-05)
Run scheme signs in automatically as the admin/pro account via `DEV_EMAIL`/`DEV_PASSWORD`
build settings, sourced from `Configs/Secrets.xcconfig` (gitignored, real values also in
repo-root `.env.accounts.local`) and wired into the Debug config via `project.yml`'s
`configFiles`. Triggers `AppState.autoLoginIfNeeded()` (DEBUG-only). If someone clones
fresh, `xcodegen generate` will fail without `Configs/Secrets.xcconfig` existing --
create it with `DEV_EMAIL = ...` / `DEV_PASSWORD = ...` (escape `$` as `$$`).
Do NOT put real credentials in `project.yml`, the shared `.xcscheme`, or any
git-tracked file -- only in the gitignored xcconfig.

## Known bugs (2026-07-05)
- Markets drawer drag gesture is choppy/non-smooth when pulled up -- not yet
  investigated, likely gesture/animation tuning in the drawer's DragGesture handler.
- Autopilot paper-mode trading was silently a no-op below ~$150 notional cap
  (whole-share floor() on stock-only watchlist). Fixed: paper mode now also
  trades fractional BTC (`server/api/broker/morning-run.js`), and the iOS
  max-per-trade slider goes down to $0.01. Still fundamentally paper/simulated --
  actual live trading needs a real brokerage with trade permission (Alpaca/IBKR),
  SnapTrade/Wealthsimple stays read-only by design.

## Rules

- iPhone only, portrait-only, UIRequiresFullScreen
- Map is home screen (tab 0), no jumps on load
- All data preloaded on launch in parallel (stocks, crypto, commodities, finance, Tally, fear/greed)
- Stay logged in between launches (session cookie + keychain)
- No emojis
- Follows system appearance (auto light/dark). No `preferredColorScheme` lock. `Palette` is fully adaptive (see `Helpers/Helpers.swift`)

## Tabs

1. **Situation** — MapKit map with 8 toggleable live data layers. Default home screen.
2. **Markets** — Stocks/commodities/crypto with filter segments. Inline portfolio (collapsible): net worth, debt, payday. Daily Brief + Fear & Greed Index. Feed pills: News | Macro | Alerts. TickerBarView lives here (not ContentView).
3. **Portfolio** — Spending chart + forecast, holdings, budget, debt/goals calendar, statements.
4. **Settings** — Profile (avatar + keychain), subscription tier, Tally integration. Security: email/password. Map layers under dev mode only.

## Run

```bash
xcodegen generate
xcodebuild -project Epiphany.xcodeproj -scheme Epiphany -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
xcodebuild test -project Epiphany.xcodeproj -scheme Epiphany -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

Version lives in `project.yml` (`MARKETING_VERSION`). On every release, sync the README badge and the CLAUDE.md header line to it -- all three must match the build.

## Key Files

- `Views/SituationView.swift` — MapKit map (earthquakes, flights, incidents, weather, crime, events, traffic, wildfires). Map layer switcher (Hybrid/Satellite/Standard/Terrain) persisted via AppStorage. Venue category chips (Restaurant/Gas/Groceries/Coffee/Parks/Shopping) trigger MKLocalSearch.
- `Views/MarketsView.swift` — Markets list + inline portfolio, stock detail sheets, TickerBarView (scoped here to avoid back-button overlap on other tabs)
- `Views/PortfolioView.swift` — Spending chart, holdings, budget, debt/goals calendar, statements
- `ContentView.swift` — Tab navigation (Situation/Markets/Portfolio/Settings), parallel data preloading on launch
- `Models/AppState.swift` — @Observable shared state, avatar persistence
- `API/EpiphanyAPI.swift` — All backend requests. `fetchPriceHistory` maps display ranges (1m, 15m, max) to Yahoo Finance range+interval pairs
- `Services/TallyService.swift` — Tally API client + keychain credentials
- `Models/SituationData.swift` — Map data models (Flight now includes velocityKnots, headingDeg)
- `Helpers/SVGRasterizer.swift` — WKWebView-based SVG-to-UIImage converter (fixes web-uploaded SVG avatars)
- `Views/SettingsView.swift` — Avatar generator picks 1 of 3 topologies (star, hexagon, mesh) with high jitter and variable node sizes

## Recent Fixes

- **Markets UI polish** (06-18): Drawer top-area shows a horizontally scrolling sparkline ticker when fully expanded (`.large`). Search + filter moved to a top-right `ellipsis.circle` menu (Asset Type/Sort/Direction), replacing the old inline "Sort & Filter" list section. Markets list rows no longer have padded card backgrounds. `StockRow` shows company name below the ticker symbol.

- **Markets search bar** (06-17): Search now matches native iOS Stocks app — bottom-pinned bar (mic icon, blue circular X to dismiss) via `safeAreaInset(edge: .bottom)`, auto-focuses keyboard on activation, replaces old inline top-of-list search row. Floating search icon hides while active.
- **PersonModels test drift** (06-17): `SocialLink`/`PersonSearchResult` now conform to `Identifiable` (`id` = url) and `SocialLink` gained computed `displayName`/`systemImage` (fallback to platform name / "globe"); `PersonSearchResult` decodes missing fields as `""` instead of failing. Fixes `PersonDataTests`. `AppStateTests.swift` drift against `User`/`APIError`/`PriceAlert` fixed (06-17): removed stale `avatar`/`createdAt` params from `User` inits, `price:`→`targetPrice:`+`direction:` on `PriceAlert`, `.serverError`→`.httpError(500, ...)` on `APIError` mocks. Not yet confirmed green on a real machine (xcodebuild unavailable in this environment — full Xcode not selected).
- **Markets sparklines** (06-16): StockRow now renders sparklines with minimal data (1+ points), not just 2+. Fixes 10-15% missing graphs. Fetch changed to `.task` for proper async lifecycle.

## Known Issues / Next

- Wealthsimple unofficial API exists in `src/utils/brokers/wealthsimple.js` — not yet wired to portfolio sync
- 500 error intermittent on app startup (~30-45 min window 06-16) — likely Yahoo Finance IP block or crumb fetch failure; monitor after deploy
- Changelog v2.5.1 (2026-06-28): FloatingTabBar now uses fill variants for selected state (map.fill, briefcase.fill, gearshape.fill). Added symbolEffect(.bounce) on tab selection.
