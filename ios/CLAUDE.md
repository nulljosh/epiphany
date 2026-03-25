# Opticon iOS

v3.1.0

## Rules

- App scope: iPhone app. Four tabs: Portfolio, Markets, Map, Settings
- Map is the main feature -- no jumps on load
- Stay logged in between launches
- Portfolio opens to Spending
- Portrait-only, UIRequiresFullScreen
- No emojis

## Run

```bash
xcodegen generate
xcodebuild -scheme Opticon -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

## Key Files

- `ContentView.swift` -- tabs
- `API/OpticonAPI.swift` -- backend requests
- `Models/AppState.swift` -- shared state
- `Views/SituationView.swift` -- map with 7 data layers (earthquakes, flights, incidents, weather, crime, local events, traffic)
- `Models/SituationData.swift` -- map data models
- `Views/PortfolioView.swift` -- portfolio, spending, debt projections
- `Models/TradingSimulator.swift` -- 61-asset trading simulator (Kelly sizing, Monte Carlo)
- `Views/SimulatorView.swift` -- simulator UI with equity curve chart
- `Styles/BounceButtonStyle.swift` -- spring press effect
- `Services/TallyService.swift` -- tally API client + keychain
- `Models/SimulatorAchievements.swift` -- achievement system
- `Models/SimulatorLeaderboard.swift` -- top runs leaderboard
- Tests in `Tests/`
