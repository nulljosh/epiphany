# Epiphany loop handoff (2026-10-29, late afternoon)

## What the loop is

Work the open Epiphany GitHub issues toward A+, one version at a time. Each fix gets QA on iOS, Mac and web, with screenshots. Push to main when iOS and Mac build green. App Store submissions, GitHub releases and tags wait for Joshua's yes. Batches come from the open issues first, then `roadmap.md`.

## Where things stand

- 4.0.0 is WAITING_FOR_REVIEW on iPhone and Mac. iOS 3.0.1 and Mac 3.0.0 stay the live builds until Apple decides. Do not submit anything else and do not cancel a review.
- 5.0.0, 6.0.0 and 7.0.0 are on main, built green on iOS and Mac, and are repo-only until Apple decides on 4.0.0. The web for 6.0.0 is deployed.
- 5.0.0: Look Around shows again on place pages, including our own pins through a coordinate fallback. Place and event pages show drive time and distance. Event pages get a Look Around photo, and the Mac event page has a mini map and Directions. Mac news thumbnails download once per URL. The iOS Debt calendar is gone.
- 6.0.0: crypto and commodity pages show a live price polled every 15 seconds from the 1-minute chart, with 1M and 15M ranges. The chart axis fits the data. Only the digits that change light up on a tick, on iOS, Mac and web. Mac 1-day charts get 5-minute bars.
- 7.0.0: flights draw as planes turned to their heading on iOS and Mac. Map clusters no longer repeat the count under the badge. An Apple Watch complication shows one chosen symbol's price and day change.
- Closed or fixed since the last handoff: #228, #215, #218, #216, #101, #226, #224, #141. #217 and the Watch complication (#181) are fixed in code. #222 is still open for the cluster badge.
- The GitHub releases for 5.0.0 and later were blocked by a permission rule. Joshua can cut them.
- Stage files by exact path. Do not commit the untracked folders `.claude/skills/compose-app-icon/` and `ios/fastlane/screenshots/en-US/`.

## Next, in order

1. Next up is 8.0.0: take the open issues in order, starting with the map cluster badge (#222).
2. Refresh the App Store screenshots for the new Markets look (#145, #153) when 4.0.0 is cleared or the next submission is ready. QA each one on iOS and Mac.
3. Then the remaining open issues, to A+ on every platform that has the code.

Blocked on Joshua, no work without a yes: App Store submissions, GitHub releases and tags (v5.0.0 and later), the production KV subscriptions cleanup, the BLS API key, and the Google callback URL for the new domain (#210).

## Restart prompt

```
/loop to v10, then 100. Keep eye on usage.
```
