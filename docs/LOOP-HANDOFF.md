# Epiphany loop handoff (2026-10-29, evening)

## What the loop is

Build Epiphany one major version at a time toward v100, using the Mobbin gap table in `roadmap.md` as the work list through 10.0 and the version plan after it. Each version ships on web, iPhone and Mac together, with light and dark screenshots, then gets committed, pushed and the web deployed. Keep a visible task list and tick items off as they ship. Keep an eye on weekly usage and checkpoint with /save near 90 percent.

## Where things stand

- 8.0.0 is on main and the web is live: S&P 500, Nasdaq and Dow cards with top movers, full-screen charts you can scrub (iPhone cover, Mac bigger chart, web overlay with Esc), price alerts that fire with the app closed on iPhone.
- The Mac app was redesigned in 8.0.0: Markets is a list column with the picked stock beside it, Settings and Portfolio hold a readable width, light mode works everywhere, the bottom bar is Liquid Glass, and the app boots with the lyre splash.
- 4.0.0 is still WAITING_FOR_REVIEW on iPhone and Mac. iOS 3.0.1 and Mac 3.0.0 are live. 5.0.0 to 8.0.0 are repo-only until Apple decides. Do not submit anything else and do not cancel a review.
- Stage files by exact path. Never commit `.claude/skills/compose-app-icon/` or `ios/fastlane/screenshots/en-US/`.

## Next, in order

1. 9.0.0: upcoming bills from the server's recurring-charge detection, income versus spending bars by month, and insight cards from statements, on web, iPhone and Mac.
2. 10.0.0: a map filter bar (incident type and time window) and saved places with nearby incident counts.
3. After 10.0.0, follow the version plan in `roadmap.md` to v100, one major per theme.
4. When Apple clears 4.0.0, refresh the App Store screenshots (#145, #153) and submit the newest build on Joshua's yes.

Blocked on Joshua: App Store submissions, GitHub releases and tags (v5.0.0 and later), placing the App Store header video, the production KV subscriptions cleanup, the BLS API key, the Google callback URL for the new domain (#210).

## Restart prompt

```
/loop to v100 with QA and screenshots. Keep a task list and keep an eye on usage.
```
