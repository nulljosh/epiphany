# UsageLedger

Local-first iOS LLM usage tracker. SwiftUI + SwiftData. Tracks usage per provider, model, project, and session with token counts and cost.

## Dev
xcodegen generate && open UsageLedger.xcodeproj

## Structure
UsageLedgerApp.swift    Entry point, ModelContainer setup
Models/                 UsageEntry, UsageProject, UsageSession (SwiftData @Model)
Views/                  ContentView (dashboard + list), AddEntryView (form)
Components/             SummaryCard

## Conventions
- iOS 17+, SwiftUI only, @Observable
- SwiftData for persistence (local-only, no backend)
- xcodegen (project.yml), no checked-in .xcodeproj
- Providers: OpenAI, Anthropic, Google, Ollama, Custom

## Status
v0.1.0 -- MVP: log entries, dashboard, project tracking, seed data.
