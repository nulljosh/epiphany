# Epiphany loop handoff (2026-11-09, evening)

## What the loop is

Work down the open Mobbin rows in `roadmap.md`, one row per minor version, until the list is empty. The open rows are 6.4 (Markets chips: Now, Macro, Crypto), 6.5 (two recent updates on a stock page) and 6.6 (earnings results alert). A fix is a patch; a major only on Joshua's call (see Versioning in `CLAUDE.md`). Never aim at a version number. Each version ships on web, iPhone and Mac together, with light and dark screenshots, then gets committed, pushed and the web deployed. Keep a visible task list and tick items off as they ship. Keep an eye on weekly usage and checkpoint with /save near 90 percent.

## Where things stand

- The repo is at 6.3.2 and the web is live.
- iOS 6.3.2 (iPhone statement upload fix) is with Apple for review. Mac and Watch are live at 6.3.1. Do not cancel the review.
- The iPhone statement upload fix has not been tried on a real phone yet. The Mac app still reads picked files the old way.
- Holdings showing as days old is still open; the real cause is unconfirmed.
- The App Store screenshots need a refresh for the new Markets look (#145, #141, #153).
- Shipped in 6.0 to 6.3: the Mobbin pass 11 rows 6.1 to 6.3 (rain radar loop, weather warning banner over the map centre, holdings against the S&P 500 today).
- Stage files by exact path. Never commit `.claude/skills/compose-app-icon/` or `ios/fastlane/screenshots/en-US/`.
- Blocked on Joshua: App Store submissions, GitHub releases and tags, the BLS API key, the Google callback URL for the new domain (#210), the APNs key (#180), trading (18.0) and a FRED API key.

## Next, in order

1. When Apple clears iOS 6.3.2, release it and refresh the App Store screenshots (#145, #153).
2. 6.4.0: Markets chips for Now, Macro and Crypto. Then 6.5 and 6.6 from Mobbin pass 11.
3. Then the next Mobbin pass.

## Restart prompt

```
/loop down the open Mobbin rows in roadmap.md, one minor version each, with QA and screenshots. Keep a task list and keep an eye on usage.
```
