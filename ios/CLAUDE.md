# Epiphany iOS

v1.6.0 — Native iPhone intelligence app. 5-tab SwiftUI app, portrait-only, dark mode only. API: epiphany.heyitsmejosh.com

## Rules

- iPhone only, portrait-only, UIRequiresFullScreen
- Map is home screen (tab 0), no jumps on load
- All data preloaded on launch in parallel (stocks, crypto, commodities, finance, Tally, fear/greed)
- Stay logged in between launches (session cookie + keychain)
- No emojis

## Tabs

1. **Situation** — MapKit map with 8 toggleable live data layers. Default home screen.
2. **Markets** — Stocks/commodities/crypto with filter segments. Inline portfolio (collapsible): net worth, debt, payday. Daily Brief + Fear & Greed Index.
3. **Portfolio** — Spending chart + forecast, holdings, budget, debt/goals calendar, statements.
4. **People** — Person search with Google/DuckDuckGo/Wikipedia cascade, social links, indexed profiles.
5. **Settings** — Profile (avatar + keychain), subscription tier, map layer toggles, Tally integration.

## Run

```bash
xcodegen generate
xcodebuild -project Epiphany.xcodeproj -scheme Epiphany -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
xcodebuild test -project Epiphany.xcodeproj -scheme EpiphanyTests -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

## Key Files

- `Views/SituationView.swift` — MapKit map (earthquakes, flights, incidents, weather, crime, events, traffic, wildfires)
- `Views/MarketsView.swift` — Markets list + inline portfolio, stock detail sheets
- `Views/PortfolioView.swift` — Spending chart, holdings, budget, debt/goals calendar, statements
- `Views/PeopleView.swift` — Person search + index grid
- `ContentView.swift` — Tab navigation, parallel data preloading on launch
- `Models/AppState.swift` — @Observable shared state, avatar persistence
- `API/EpiphanyAPI.swift` — All backend requests (base: epiphany.heyitsmejosh.com, 2min cache, cookie session)
- `Services/TallyService.swift` — Tally API client + keychain credentials
- `Models/SituationData.swift` — Map data models
