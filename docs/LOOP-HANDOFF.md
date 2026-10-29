# Epiphany loop handoff (2026-10-29, late evening)

## What the loop is

Build Epiphany one major version at a time toward v100, using the Mobbin gap table in `roadmap.md` as the work list through 10.0 and the version plan after it. Each version ships on web, iPhone and Mac together, with light and dark screenshots, then gets committed, pushed and the web deployed. Keep a visible task list and tick items off as they ship. Keep an eye on weekly usage and checkpoint with /save near 90 percent.

## Where things stand

- 19.0.0 is on main and the web is live: map buttons that were white on glass now use `.primary`, the indigo weather pin is amber, the unused Mac `MarketCard` is gone, and the web Markets header no longer covers the index cards (`top: -16`). 18.0 waits on Joshua. The iPhone news drawer drag still needs an on-device look before any fix. 17.0.0: commodity and crypto pages on iPhone and Mac have the SMA 20 and EMA 50 overlays and the signal pill (`SignalPill`, `IndicatorChip` in `Shared/Indicators.swift`); the web already shared one detail page. 16.0.0 is live: the Worker checks every untriggered alert every 15 minutes and emails the owner once (`server/api/alerts-check.js`). The account is at the Workers Free cap of 5 cron triggers, so Epiphany now runs one `*/15` trigger and `worker/schedule.js` picks the old fixed-time jobs by the clock. 15.0.0 put the watchlist in the Mac menu bar with Notification Center alerts. 11.0 instant open on Mac and web, 12.0 first run for everyone with no made-up numbers, 14.0 named watchlists on all three. 13.0 (Google sign-in on native) is skipped until Joshua adds the new callback URL (#210).
- 10.0.0 recap: 8.0 brought index cards, movers, full-screen charts and price alerts; 9.0 brought money at a glance (insight cards, bills due in 30 days, money in vs spending); 10.0 brought the map filter chip with a time window, saved places with nearby counts, and emoji map pins.
- The Mac app was redesigned (list column with detail beside it, Liquid Glass bar, lyre splash). Desktop web now has the same bottom glass tab bar. Light mode on the web is softer, with a coloured CARTO Voyager map.
- The landing was rebuilt in the Hermes layout over the live map, with the tagline "Your world, on one screen."
- What's New only shows for major and minor versions, never patches.
- 4.0.0 is still WAITING_FOR_REVIEW. 5.0.0 to 19.0.0 are repo-only until Apple decides. Do not submit and do not cancel a review.
- Stage files by exact path. Never commit `.claude/skills/compose-app-icon/` or `ios/fastlane/screenshots/en-US/`.

## Next, in order

1. 20.0.0: a fresh Mobbin pass, written into a new table in `roadmap.md`.
2. Then 21 to 100 per the version plan. 18.0 trading waits on Joshua. APNs push (#180) waits on an APNs key.
3. Small leftovers: the review queue (#179) from the 9.0 row.
4. When Apple clears 4.0.0, refresh the App Store screenshots (#145, #153) and submit the newest build on Joshua's yes.

Blocked on Joshua: App Store submissions, GitHub releases and tags (v5.0.0 and later), placing the App Store header video, the production KV subscriptions cleanup, the BLS API key, the Google callback URL for the new domain (#210).

## Restart prompt

```
/loop to v100 with QA and screenshots. Keep a task list and keep an eye on usage.
```
