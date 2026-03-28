# Monica iOS

v1.3.0

## What is Monica

Personal intelligence platform. Map + markets + people + local data. Palantir for regular people.

## Rules

- App scope: iPhone app. Four tabs: Map, Markets, People, Settings
- Map is the home screen (tab 0) -- no jumps on load
- Markets tab includes inline portfolio section (net worth, debt timeline, payday)
- Market filter segments: All / Stocks / Commodities / Crypto
- Map Sources on its own settings page (not inline)
- Avatar persisted in AppState (not local @State)
- All data preloaded on launch in parallel
- Stay logged in between launches
- Portrait-only, UIRequiresFullScreen
- No emojis
- Internal class names use MonicaAPI, MonicaApp

## Run

```bash
xcodegen generate
xcodebuild -scheme Monica -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

## Key Files

- `ContentView.swift` -- tabs, parallel data preloading
- `API/MonicaAPI.swift` -- backend requests
- `Models/AppState.swift` -- shared state, avatar persistence, financeDataLoaded
- `Models/Ontology.swift` -- ontology types + AnyCodable
- `Views/SituationView.swift` -- map with 7+ data layers
- `Models/SituationData.swift` -- map data models, isLowSignal filter
- `Views/MarketsView.swift` -- markets + inline portfolio + filter segments
- `Views/StockDetailView.swift` -- stock charts, fundamentals, related news
- `Views/SettingsView.swift` -- profile, subscriptions, MapSourcesSettingsView
- `Views/PeopleView.swift` -- people search with Wikipedia fallback
- `Services/TallyService.swift` -- tally API client + keychain
- Tests in `Tests/`
