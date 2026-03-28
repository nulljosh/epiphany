# Monica macOS

v0.6.0

## Rules

- Pure SwiftUI, no AppKit/UIKit
- Bottom nav only, no sidebar
- No haptics, no iOS-specific modifiers
- Keyboard shortcuts Cmd+1-5 for tabs
- Map stays steady -- no jumps on load or state changes
- No emojis

## Run
```bash
xcodegen generate
xcodebuild -project Monica.xcodeproj -scheme Monica -destination 'platform=macOS' build
xcodebuild test -project Monica.xcodeproj -scheme MonicaTests -destination 'platform=macOS'
```

## Key Files

- `Views/SituationView.swift` -- MapKit map (earthquakes, flights, incidents)
- `Views/MarketsView.swift` -- Sortable table with search
- `Views/PortfolioView.swift` -- Spending forecast, income scenarios, debt projections
- `Models/AppState.swift` -- @Observable shared state
- `API/MonicaAPI.swift` -- Backend requests
- `Views/StockDetailView.swift` -- Stock detail with chart scrub, stats grid, related news
- `Services/TallyService.swift` -- Tally API client + keychain
- `Models/SituationData.swift` -- Map data models (earthquakes, flights, crime, traffic, events)
