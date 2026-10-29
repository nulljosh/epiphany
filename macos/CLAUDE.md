# Epiphany macOS

v12.0.0. Mac app with five sections (Situation, Markets, People, Portfolio, Settings) on a Liquid Glass bottom bar. Boots with the same lyre splash as iPhone. Shared Swift lives in `../Shared`.

## Run

```bash
xcodegen generate
xcodebuild -project Epiphany.xcodeproj -scheme Epiphany -destination 'platform=macOS' build
xcodebuild test -project Epiphany.xcodeproj -scheme EpiphanyTests -destination 'platform=macOS'
```

QA: `open -n Epiphany.app --args -qaSection Markets` opens on a section (Debug builds only).

## Rules

- SwiftUI first. AppKit only where SwiftUI has no answer (window colours, for example).
- Bottom bar, no sidebar. Cmd-1 to Cmd-5 switch sections.
- It's a Mac app, not a stretched iPad: lists sit in a fixed column, detail opens beside them, settings and portfolio hold a readable width.
- Every colour works in light and dark. Never hard-code white text or white fills; use `.primary` and `.secondary`.
- Glass only on the functional layer (the bottom bar, floating controls). Content uses plain fills or materials.
- The map stays steady: no jumps on load.
- No haptics. No emojis, except the ✈️ flight markers.

## Key files

- `Views/ContentView.swift`: sections, bottom bar.
- `Views/MarketsView.swift`: list column on the left, overview or the picked asset on the right.
- `Views/StockDetailView.swift`: stock chart, indicators, scrub, bigger-chart toggle (Cmd-Shift-F).
- `Views/SituationView.swift`: the map and its layers.
- `Views/PortfolioView.swift`: spending, holdings, budget, statements.
- `API/EpiphanyAPI.swift`: every request.
