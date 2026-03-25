# Monica iOS

v5.0.0

## What is Monica

Personal intelligence platform. Map + markets + local data. Becoming a public data aggregator -- Palantir for regular people. Future: people search, predictions, gas prices, transit.

## Rules

- App scope: iPhone app. Three tabs: Map, Markets, Settings
- Map is the home screen (tab 0) -- no jumps on load
- Markets tab includes inline portfolio section (net worth, debt timeline, payday)
- Stay logged in between launches
- Portrait-only, UIRequiresFullScreen
- No emojis
- Internal class names still use "Opticon" (OpticonAPI, etc.) -- only branding is "Monica"

## Run

```bash
xcodegen generate
xcodebuild -scheme Monica -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

## Key Files

- `ContentView.swift` -- tabs
- `API/OpticonAPI.swift` -- backend requests
- `Models/AppState.swift` -- shared state
- `Views/SituationView.swift` -- map with 7+ data layers
- `Models/SituationData.swift` -- map data models
- `Views/MarketsView.swift` -- markets + inline portfolio
- `Views/StockDetailView.swift` -- stock charts, fundamentals, related news
- `Views/SettingsView.swift` -- profile, subscriptions, map toggles
- `Services/TallyService.swift` -- tally API client + keychain
- Tests in `Tests/`
