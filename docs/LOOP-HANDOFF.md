# Epiphany loop handoff (2026-10-21, late)

## What the loop is

Work Epiphany one batch at a time. Each pass fixes a batch from `docs/reference/code-sweep-2026-10-04.md` or a doable item in `roadmap.md`, builds iOS and Mac, mirrors the fix to every platform that has the same code, and commits. Pushes and App Store submissions wait for Joshua's yes.

## Where things stand

- iOS 3.0.1 was rebuilt with all of today's native work (ticker search, earnings and calendar export, budget vs actual, recurring charges, map layers, watchlist widgets). The old review was pulled; the new build is uploading and resubmitting.
- Mac 3.0.0 is still in review. Mac 3.0.1 waits for it to clear.
- The Stripe business website is jaybulb.com (verified live). The product copy no longer says Opticon.
- Issues went from 133 to 67 open today. #173 (first-run statements card) is live; #123 and #125 are closed.
- Privacy: personal finance data was removed from the public bundle and the history was rewritten. Old commit b33cd6c is still reachable by SHA through old PR refs; Joshua has to ask GitHub support to purge it.
- Still holding personal figures in code: `src/utils/roadmapSim.js` (income constant) and the payroll fixture in `tests/api/recurring.test.js`. Replace them with neutral values before the next release.

## Next, in order

1. Check #116 (Watch target lacks Shared/). The Watch app does not use signal code, so it is likely not needed. Report the finding; do not close it.
2. #157: the remaining FRED macro series.
3. Roadmap items that need no one: MapSourcesSettingsView (wire or delete), web Places fallback when Overpass is down, macOS sign-in and onboarding sheet overlap, budget mid-month projection.
4. Brand kit: the landing footer now uses Prometheus. Check the brand kit art matches.

Blocked on Joshua, do not do without a yes: submit or push anything to the App Store or GitHub; the GitHub support purge request; the BLS API key; the Google callback URL for the new domain (#210).

## Restart prompt

```
/loop next release: read docs/LOOP-HANDOFF.md, do the next item in "Next, in order" that needs no one, build iOS and Mac (look for BUILD SUCCEEDED), mirror to every platform with the same code, commit locally. Do not push or submit to the App Store without Joshua's yes. Never write account, phone or finance figures into the repo. Update this file.
```
