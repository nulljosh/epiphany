# Epiphany loop handoff (2026-10-20, late morning)

## What the loop is

Work Epiphany toward its next major version, 3.0.0. Each pass fixes a batch from `docs/reference/code-sweep-2026-10-04.md` or a doable item in `roadmap.md`, builds iOS and Mac, mirrors the fix to every platform that has the same code, commits and pushes. When the sweep and the doable roadmap items are done, bump to 3.0.0 and ship it.

## Where things stand

- iOS and Mac 2.5.18 (animated map pins, blue bulb icon) are waiting for App Review, submitted 2026-10-20. iOS 2.5.17 and Mac 2.5.16 are live.
- Sweep batches 1 and 2 are pushed: 24 of 45 leads closed (tap targets, amounts that saved as 0, double alert submit, comma prices, endless spinners, raw error pages, silent cancels, Mac 401 reopens sign in).
- Epiphany Sans is in `fonts/` and `brand/` but no screen uses it yet.
- Ship gotchas: `ios/ExportOptions.plist` now exports an IPA so `asc workflow run ship-ios` can publish it. Submit fails until What's New is set on the en-CA locale. Watch has no ship workflow.

## Next, in order

1. Sweep batch 3: the rest (interactive glass stealing taps on the map chips, news drawer sheet collision, NearbyPlacesSheet search bar, Settings textContentType, clear-search flicker, Mac search clear and Escape, Mac places sheet close, Mac bbox for incidents and traffic, web Places panel close, web search Escape, OSM attribution).
2. Wire Epiphany Sans into iOS, Mac and web.
3. Roadmap items that need no one: MapSourcesSettingsView (wire or delete), web Places fallback when Overpass is down, macOS sign-in and onboarding sheet overlap.
4. Bump to 3.0.0 on iOS, Mac, Watch and web, set What's New, ship iOS and Mac, deploy web.

## Restart prompt

```
/loop to next major semver: read docs/LOOP-HANDOFF.md, do the next item in "Next, in order", build iOS and Mac (look for BUILD SUCCEEDED), mirror to every platform with the same code, commit and push, update this file.
```
