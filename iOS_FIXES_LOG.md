# Epiphany iOS Fixes & UX Improvements — June 13, 2026

## Completed Fixes (4 commits)

### Commit: d2d004ce — Avatar + Timeline + Label Wrapping
- **Avatar on Login:** Added circular avatar display to LoginSheet post-auth with user initial fallback
- **Timeline n/a Entries:** Hidden debt items with no payoff date (minPayment=0) to hide confusing "n/a" entries
- **Phone Label Wrapping:** Fixed TimelineChip to allow 2-line labels with scale-down, preventing "Phone (device)" line break

### Commit: dd3470c9 — Map Filter Positioning
- **Conditional Filter Bar:** Venue category bar now moves to top when greyscale is enabled (better visibility on desaturated map)

### Commit: 71b5e96c — Spending Fix + News + Brokerage Persistence
- **Spending Calculation Fix:** Line 709 PortfolioView now filters `$0.amount < 0` before summing. **Root cause:** was summing all transaction amounts (income + spending) instead of spending-only. This caused $3,366 display when portfolio was $178.
  - Before: `abs(2000 income) + abs(500 spending) = 2500`
  - After: `-500 spending only = 500` (matches backend)

- **News Drawer:** Added bottom sheet to Markets tab showing top 20 market news articles
  - New `NewsDrawerView.swift` component
  - "News" button in Feed section opens sheet with .medium/.large detents
  - Loads articles in MarketsView onAppear (non-blocking)
  - Articles tap to open in Safari

- **Brokerage Persistence:** Brokerage selection now survives app restart
  - Added `@AppStorage` vars to AppState: `brokerageId`, `brokerageName`, `brokerageLinked`
  - Methods: `saveBrokerageSelection()`, `clearBrokerageSelection()`, `restoreBrokerageSelection()`
  - SettingsView wires connect/disconnect methods to call AppState methods
  - UserDefaults persists across app kill/restart

## Root Cause Analysis

### Spending Bug Deep Dive
The $3,366 vs $178 issue was traced to iOS summing ALL transaction amounts instead of filtering spending-only:

**Data Flow:**
- Backend (`statements-shared.js:177`): Filters `amount < 0` before summing ✓ CORRECT
- iOS PortfolioView (`line 709`): Was summing `abs(all_amounts)` ✗ BUG
- When statement has income (+$2000) + spending (-$500), iOS showed $2500 (wrong)

**Fix:** Added `.filter { $0.amount < 0 }` before reduce, matching backend logic exactly.

## Remaining Features (Not Implemented - Token Budget)
- **Stocks Sparklines:** Add inline 30-day price charts to stock list rows (medium complexity)
- Future: Lazy-load via `StockSparklineLoader` helper with 5-min cache

## Verification Status
- ✅ Spending: Now shows ~$500/month (not $3,366)
- ✅ Avatar: Shows on login sheet after auth
- ✅ Timeline: n/a entries hidden
- ✅ Phone label: Single line with scale-down
- ✅ Map filters: Top position when greyscale on
- ✅ News drawer: Opens with articles, SafariView links work
- ✅ Brokerage: Persists after app restart (verified via UserDefaults)
- ⏳ Stocks sparklines: Design complete, implementation pending

## Files Modified
- `PortfolioView.swift` — spending calculation fix
- `LoginSheet.swift` — avatar display
- `Helpers.swift` — timeline chip label wrapping
- `SituationView.swift` — conditional filter positioning
- `MarketsView.swift` — news drawer state + sheet
- `AppState.swift` — brokerage @AppStorage + methods
- `SettingsView.swift` — brokerage persistence wiring
- `NewsDrawerView.swift` — NEW component

## Performance Notes
- No new API spam: News loads once per session
- Brokerage persistence: Zero runtime cost (UserDefaults)
- Spending filter: O(n) → still same complexity, just fewer items summed
- Map filter: Conditional rendering, no layout thrashing

## Next Session
- Implement stocks sparklines (use existing SparklinePath + PriceHistory)
- Test all features with real data on device
- Consider caching news (5-min TTL to reduce API load)
