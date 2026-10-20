# Epiphany loop handoff (2026-10-20, afternoon)

## What the loop is

Work Epiphany toward its next major version, 3.0.0. Each pass fixes a batch from `docs/reference/code-sweep-2026-10-04.md` or a doable item in `roadmap.md`, builds iOS and Mac, mirrors the fix to every platform that has the same code, commits and pushes. The 3.0.0 bump is submitted; the loop now works the doable roadmap items and ships the next release after 3.0.0 clears.

## Where things stand

- 3.0.0 is WAITING_FOR_REVIEW on iOS and Mac, submitted 2026-10-20. It folds in the 2.5.18 build (same store version, renamed). Apple returned a 500 on one submit; the retry went through. Web 3.0.0 is deployed and live. Watch has no ship workflow.
- Sweep done: all 45 leads closed (the last two: clearing a search drops focus first).
- The landing page is restyled in the Apollo theme: Epiphany Display caps headlines over a halftone Apollo on a night blue page, Epiphany Sans self-hosted, dark map credit box.
- The name stays Epiphany (Joshua, 2026-10-20: "just stick with epiphany for now"). The Apollo theme stays: lyre icon, laurel quotes, Tenor Sans headlines, brand kit at /brand.
- Epiphany Sans is in `fonts/` and `brand/` and the landing uses it, but the iOS, Mac and web apps do not use it yet.
- Ship gotchas: `ios/ExportOptions.plist` exports an IPA so `asc workflow run ship-ios` can publish it. Submit fails until What's New is set on the en-CA locale.

## Next, in order

1. Wait for App Review on 3.0.0 (iOS and Mac). If Apple rejects it, reply with the reasons first; do not resubmit unchanged.
2. Wire Epiphany Sans into iOS, Mac and web.
3. Roadmap items that need no one: MapSourcesSettingsView (wire or delete), web Places fallback when Overpass is down, macOS sign-in and onboarding sheet overlap.

## Restart prompt

```
/loop to next major semver: read docs/LOOP-HANDOFF.md, do the next item in "Next, in order", build iOS and Mac (look for BUILD SUCCEEDED), mirror to every platform with the same code, commit and push, update this file.
```
