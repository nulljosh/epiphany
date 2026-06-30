# Epiphany macOS

v2.5.2 — Native macOS intelligence dashboard. 5-tab SwiftUI app (Situation, Markets, People, Portfolio, Settings).

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
3. **People** (Cmd+3) — DONE 2026-06-21: `PeopleView.swift` was already fully built, wired into `ContentView.AppSection` (was previously left out of the enum entirely, not just hidden)
4. **Portfolio** (Cmd+4) — 6-subtab financial dashboard: Spending, Holdings, Budget, Debt, Goals, Statements
5. **Settings** (Cmd+5) — Profile, subscription tier, map layer toggles, Tally integration

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
- `Models/AppState.swift` — @Observable shared state, parallel data loading
- `API/EpiphanyAPI.swift` — All backend requests (auth, stocks, map data, finance, people)
- `Services/TallyService.swift` — Tally API client + keychain
- `Models/SituationData.swift` — Map data models (earthquakes, flights, crime, traffic, events, wildfires)
