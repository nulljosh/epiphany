# Epiphany macOS

v1.3.0 — Native macOS intelligence dashboard. 4-tab SwiftUI app (Situation, Markets, Portfolio, Settings).

## Rules

- Pure SwiftUI, no AppKit/UIKit
- Bottom nav only, no sidebar
- No haptics, no iOS-specific modifiers
- Keyboard shortcuts Cmd+1-5 for tabs
- Map stays steady -- no jumps on load or state changes
- No emojis

## Tabs

1. **Situation** (Cmd+1) — MapKit map with 8 toggleable live data layers
2. **Markets** (Cmd+2) — Sortable stocks/commodities/crypto table with search, stock detail sheets
3. **Portfolio** (Cmd+3) — 6-subtab financial dashboard: Spending, Holdings, Budget, Debt, Goals, Statements
4. **Settings** (Cmd+4) — Profile, subscription tier, map layer toggles, Tally integration
5. **People** (Cmd+5) — Person search with Google/DuckDuckGo/Wikipedia cascade, indexed profiles

## Run

```bash
xcodegen generate
xcodebuild -project Epiphany.xcodeproj -scheme Epiphany -destination 'platform=macOS' build
xcodebuild test -project Epiphany.xcodeproj -scheme EpiphanyTests -destination 'platform=macOS'
```

## Key Files

- `Views/SituationView.swift` — MapKit map (earthquakes, flights, incidents, weather, crime, events, traffic, wildfires)
- `Views/MarketsView.swift` — Sortable table with search, stock detail with chart scrub
- `Views/PortfolioView.swift` — Spending forecast, income scenarios, debt payoff projections
- `Views/PeopleView.swift` — Person search + index
- `Models/AppState.swift` — @Observable shared state, parallel data loading
- `API/EpiphanyAPI.swift` — All backend requests (auth, stocks, map data, finance, people)
- `Services/TallyService.swift` — Tally API client + keychain
- `Models/SituationData.swift` — Map data models (earthquakes, flights, crime, traffic, events, wildfires)
