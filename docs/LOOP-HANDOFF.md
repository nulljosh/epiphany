# Epiphany loop handoff (2026-10-28)

## What the loop is

Work Epiphany one batch at a time. Each pass fixes a batch from `docs/reference/code-sweep-2026-10-04.md` or a doable item in `roadmap.md`, builds iOS and Mac, mirrors the fix to every platform that has the same code, and commits. Pushes and App Store submissions wait for Joshua's yes.

## Where things stand

- The loop is paused. It stopped at 95% weekly usage on 2026-10-21. Restart after the Saturday 22:00 reset, but commits kept landing on main until about 00:07 on 2026-10-22, so check that nothing is still running first.
- iOS 3.0.1 was rebuilt with today's native work and resubmitted. It is WAITING_FOR_REVIEW.
- Mac 3.0.0 is still in review. Mac 3.0.1 waits for it to clear.
- Since 2026-10-22: Business News pulls Google, CNBC and MarketWatch live (MarketWatch decodes numeric XML entities), and news thumbnails are pushed after 580 tests. The macOS side still uses AsyncImage, so that roadmap item stays open.
- Overnight commits on main, not confirmed in the build waiting for review: subscription totals split per currency on iOS, macOS and web, so a US$ plan stops landing in Canadian totals; native apps fetch Fear and Greed from CNN when the server is blocked (web still has no source); 108 Greek god avatars on lyre blue; the web bottom tab bar on phones; a lyre splash; QA fixes on iOS and web. Check which of these are in the next submitted build.
- 73 issues are open. Do not close any issue without Joshua.
- The Stripe business website is jaybulb.com (verified live). The product copy no longer says Opticon.
- Privacy: personal finance data was removed from the public bundle and the history was rewritten. Old commit b33cd6c is still reachable by SHA through old PR refs; Joshua has to ask GitHub support to purge it.
- Still holding personal figures in code: `src/utils/roadmapSim.js` (income constant) and the payroll fixture in `tests/api/recurring.test.js`. Replace them with neutral values before the next release.

## Next, in order

1. #157: the remaining FRED macro series.
2. Roadmap items that need no one: MapSourcesSettingsView (wire or delete), web Places fallback when Overpass is down, macOS sign-in and onboarding sheet overlap, budget mid-month projection.
3. Brand kit: the landing footer uses Prometheus. Check the brand kit art matches.

Blocked on Joshua, do not do without a yes: submit or push anything to the App Store or GitHub; the GitHub support purge request; the BLS API key; the Google callback URL for the new domain (#210); closing any issue.

## Restart prompt

```
/loop issues until 95%: read docs/LOOP-HANDOFF.md, take the next open issue or the next item in "Next, in order" that needs no one, build iOS and Mac (look for BUILD SUCCEEDED), mirror to every platform with the same code, commit locally. Do not push, close issues or submit to the App Store without Joshua's yes. Never write account, phone or finance figures into the repo. Update this file.
```
