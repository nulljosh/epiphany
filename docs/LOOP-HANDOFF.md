# Epiphany loop handoff (2026-10-29, late evening)

## What the loop is

Build Epiphany one major version at a time toward v100, using the Mobbin gap table in `roadmap.md` as the work list through 10.0 and the version plan after it. Each version ships on web, iPhone and Mac together, with light and dark screenshots, then gets committed, pushed and the web deployed. Keep a visible task list and tick items off as they ship. Keep an eye on weekly usage and checkpoint with /save near 90 percent.

## Where things stand

- 10.0.0 is on main and the web is live. 8.0 brought index cards, movers, full-screen charts and price alerts; 9.0 brought money at a glance (insight cards, bills due in 30 days, money in vs spending); 10.0 brought the map filter chip with a time window, saved places with nearby counts, and emoji map pins.
- The Mac app was redesigned (list column with detail beside it, Liquid Glass bar, lyre splash). Desktop web now has the same bottom glass tab bar. Light mode on the web is softer, with a coloured CARTO Voyager map.
- The landing was rebuilt in the Hermes layout over the live map, with the tagline "Your world, on one screen."
- What's New only shows for major and minor versions, never patches.
- 4.0.0 is still WAITING_FOR_REVIEW. 5.0.0 to 10.0.0 are repo-only until Apple decides. Do not submit and do not cancel a review.
- Stage files by exact path. Never commit `.claude/skills/compose-app-icon/` or `ios/fastlane/screenshots/en-US/`.

## Next, in order

1. 11.0.0: instant open (last prices on screen at launch, then refresh) and the real watchlist in the widget and on the Lock Screen. The roadmap's Competitor gaps section has the exact steps.
2. Then follow the version plan in `roadmap.md` (12.0 first run for everyone, 13.0 Google sign-in on native, and so on).
3. Small leftovers: the review queue (#179) from the 9.0 row, the web index cards' top edge sits a hair under the Markets header.
4. When Apple clears 4.0.0, refresh the App Store screenshots (#145, #153) and submit the newest build on Joshua's yes.

Blocked on Joshua: App Store submissions, GitHub releases and tags (v5.0.0 and later), placing the App Store header video, the production KV subscriptions cleanup, the BLS API key, the Google callback URL for the new domain (#210).

## Restart prompt

```
/loop to v100 with QA and screenshots. Keep a task list and keep an eye on usage.
```
