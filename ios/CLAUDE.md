# Epiphany iOS

v2.0.0 — Native iPhone intelligence app. 4-tab SwiftUI app (Situation, Markets, Portfolio, Settings), portrait-only, dark mode only. API: epiphany.heyitsmejosh.com

## Rules

- iPhone only, portrait-only, UIRequiresFullScreen
- Map is home screen (tab 0), no jumps on load
- All data preloaded on launch in parallel (stocks, crypto, commodities, finance, Tally, fear/greed)
- Stay logged in between launches (session cookie + keychain)
- No emojis
- Dark mode locked via `preferredColorScheme(.dark)` in EpiphanyApp — do not revert

## Tabs

1. **Situation** — MapKit map with 8 toggleable live data layers. Default home screen.
2. **Markets** — Stocks/commodities/crypto with filter segments. Inline portfolio (collapsible): net worth, debt, payday. Daily Brief + Fear & Greed Index. Feed pills: News | Macro | Alerts. TickerBarView lives here (not ContentView).
3. **Portfolio** — Spending chart + forecast, holdings, budget, debt/goals calendar, statements.
4. **Settings** — Profile (avatar + keychain), subscription tier, Tally integration. Security: email/password. Map layers under dev mode only.

## Run

```bash
xcodegen generate
xcodebuild -project Epiphany.xcodeproj -scheme Epiphany -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
xcodebuild test -project Epiphany.xcodeproj -scheme EpiphanyTests -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

## Key Files

- `Views/SituationView.swift` — MapKit map (earthquakes, flights, incidents, weather, crime, events, traffic, wildfires). Map layer switcher (Hybrid/Satellite/Standard/Terrain) persisted via AppStorage. Venue category chips (Restaurant/Gas/Groceries/Coffee/Parks/Shopping) trigger MKLocalSearch.
- `Views/MarketsView.swift` — Markets list + inline portfolio, stock detail sheets, TickerBarView (scoped here to avoid back-button overlap on other tabs)
- `Views/PortfolioView.swift` — Spending chart, holdings, budget, debt/goals calendar, statements
- `Views/PeopleView.swift` — Person search + index grid
- `ContentView.swift` — Tab navigation, parallel data preloading on launch (no ticker logic here)
- `Models/AppState.swift` — @Observable shared state, avatar persistence
- `API/EpiphanyAPI.swift` — All backend requests. `fetchPriceHistory` maps display ranges (1m, 15m, max) to Yahoo Finance range+interval pairs
- `Services/TallyService.swift` — Tally API client + keychain credentials
- `Models/SituationData.swift` — Map data models (Flight now includes velocityKnots, headingDeg)
- `Helpers/SVGRasterizer.swift` — WKWebView-based SVG-to-UIImage converter (fixes web-uploaded SVG avatars)
- `Views/SettingsView.swift` — Avatar generator picks 1 of 3 topologies (star, hexagon, mesh) with high jitter and variable node sizes

## Known Issues / Next

- Wealthsimple unofficial API exists in `src/utils/brokers/wealthsimple.js` — not yet wired to portfolio sync
