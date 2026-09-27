# Epiphany loop handoff (2026-09-26, evening)

## What the loop is

A recurring session that runs until all work is finished: Epiphany polish fixes from screenshots and roadmap items, ship iOS and macOS to the App Store, write What's New, mark roadmap items done, commit and push. The loop monitors Claude usage and avoids overspend.

## Where things stand

iOS 2.5.13 build uploaded to App Store Connect after a full polish pass (native tab bar, full-width map search, relative news timestamps, auto-refresh portfolio, markets toolbar search/filter, pie chart Other bucket by merchant, map layer zoom gating, removed stale location). macOS 2.5.3 follows the same fixes where applicable. Three roadmap items shipped and marked done: Markets toolbar, Portfolio pie Other bucket, Budget card Avg Monthly Spending (iOS only). Memory file updated with 2026-09-26 session entry. Journal appended with evening summary. Wiki pages touched: epiphany (updated 2026-09-26). Notes master.md prepended with checkpoint summary.

## Next, in order

1. Submit iOS 2.5.13 to App Store (if not already submitted auto-by-now)
2. Write What's New for iOS 2.5.13 (polish refinements, bug fixes from screenshot feedback)
3. Write What's New for macOS 2.5.3 (same fixes as iOS where applicable, platform-specific notes)
4. Submit macOS 2.5.3 to App Store
5. Mark roadmap.md items fully complete after all submissions confirmed
6. Commit final changes and push to main
7. Monitor CI green and watch for App Store status updates

## Restart prompt

```
/loop until all tasks finished: Epiphany fix list from Joshua (iOS + macOS + web mirrors) + roadmap items, then ship to App Store (ship-ios 2.5.13, ship-mac 2.5.3), write What's New, mark roadmap items done, commit+push. Keep an eye on Claude usage.
```
