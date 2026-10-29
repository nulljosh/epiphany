# Epiphany loop handoff (2026-10-29, afternoon)

## What the loop is

Work the open Epiphany GitHub issues to A+. Each fix gets QA on iOS, Mac and web, with screenshots, and gets committed locally. Native builds ship when a release is ready. Pushes, App Store submissions, issue closes and GitHub releases wait for Joshua's yes. Batches come from the issues first, then `roadmap.md`.

## Where things stand

- 3.1.0 is WAITING_FOR_REVIEW on iPhone and Mac. iOS 3.0.1 and Mac 3.0.0 stay the live builds until Apple decides. Do not resubmit or cancel a review to swap builds.
- The web is live at epiphany.jaybulb.com.
- Markets matches iOS Stocks on iOS, Mac and web. The ticker sits on top, Fear & Greed is a nav-bar chip, new accounts get a short tour, the splash ends on the Spark mascot, accounts without an avatar get a Greek god bust, and earnings dates show only on a stock page within two weeks.
- Closed today: #225, #202, #227, #219, #84, #221, #43.
- The v3.1.0 GitHub release and tag were not created. A permission rule blocked them. Joshua can cut them.
- Stage files by exact path. Do not commit the untracked folders `.claude/skills/compose-app-icon/` and `ios/fastlane/screenshots/en-US/`.
- Personal figures still sit in `src/utils/roadmapSim.js` and the payroll fixture in `tests/api/recurring.test.js`. Replace them with neutral values before the next release.

## Next, in order

1. Wait for App Review on 3.1.0. When Apple clears it, release it on Joshua's yes and ship the native builds with it.
2. Joshua's picks, no changes until he chooses: #220 (web Fear & Greed; CNN blocks the server, so either build our own index from market data or hide the chip on web), #58 (landing light mode vs the dark-only web rule), #214 (stale App Store links; needs the URL).
3. Refresh the App Store screenshots for the new Markets look (#145, #141, #153). QA each one on iOS and Mac.
4. Then the remaining open issues, one batch at a time, to A+ on every platform that has the code.

Blocked on Joshua, no work without a yes: App Store submissions, pushes, issue closes, the v3.1.0 release and tag, the production KV subscriptions cleanup, the BLS API key, and the Google callback URL for the new domain (#210).

## Restart prompt

```
/loop work the open Epiphany GitHub issues to A+ (QA every fix on iOS, Mac and web with screenshots, ship native builds when a release is ready), stop near 90% weekly usage, then /save
```
