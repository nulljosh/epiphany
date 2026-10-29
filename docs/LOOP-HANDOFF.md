# Epiphany loop handoff (2026-10-29, afternoon)

## What the loop is

Work the open Epiphany GitHub issues to A+. Each fix gets QA on iOS, Mac and web, with screenshots, and gets committed locally. Native builds ship when a release is ready. Pushes, App Store submissions, issue closes and GitHub releases wait for Joshua's yes. Batches come from the issues first, then `roadmap.md`.

## Where things stand

- 4.0.0 is WAITING_FOR_REVIEW on iPhone and Mac. It replaced 3.1.0, which was pulled from review and folded in. iOS 3.0.1 and Mac 3.0.0 stay the live builds until Apple decides. Do not resubmit or cancel a review to swap builds.
- 4.0.0 carries: prices flash green or red when they tick (iOS, Mac, web); crypto and commodity pages on iPhone and Mac with day, 52-week and 24h ranges, volume, and period high and low; a Long, Hold or Short filter on Markets (iOS and Mac); related news headlines no longer render as centred blue links.
- Markets matches iOS Stocks on iOS, Mac and web. The ticker sits on top, Fear & Greed is a nav-bar chip, new accounts get a short tour, the splash ends on the Spark mascot, accounts without an avatar get a Greek god bust, and earnings dates show only on a stock page within two weeks.
- The web is live at epiphany.jaybulb.com. The web stock pager now walks watchlist stocks, and the jaybulb.com buy page and footer no longer link the retired Sidewise app.
- Closed since the last handoff: #225, #202, #227, #219, #84, #221, #43, #41, #214, #220, #58.
- The v3.1.0 GitHub release exists. The v4.0.0 release and tag were blocked by a permission rule. Joshua can cut them.
- Stage files by exact path. Do not commit the untracked folders `.claude/skills/compose-app-icon/` and `ios/fastlane/screenshots/en-US/`.
- Personal figures still sit in `src/utils/roadmapSim.js` and the payroll fixture in `tests/api/recurring.test.js`. Replace them with neutral values before the next release.

## Next, in order

1. Wait for App Review on 4.0.0. When Apple clears it, release it on Joshua's yes and ship the native builds with it.
2. Refresh the App Store screenshots for the new Markets look (#145, #141, #153). QA each one on iOS and Mac.
3. Then the remaining open issues, one batch at a time, to A+ on every platform that has the code.

Blocked on Joshua, no work without a yes: App Store submissions, pushes, issue closes, the v4.0.0 release and tag, the production KV subscriptions cleanup, the BLS API key, and the Google callback URL for the new domain (#210).

## Restart prompt

```
/loop work the open Epiphany GitHub issues to A+ (QA every fix on iOS, Mac and web with screenshots, ship native builds when a release is ready), stop near 90% weekly usage, then /save
```
