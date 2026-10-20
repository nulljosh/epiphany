# Epiphany loop handoff (2026-10-20, late morning)

## What the loop is

Work Epiphany toward its next major version, 3.0.0. Each pass fixes a batch from `docs/reference/code-sweep-2026-10-04.md` or a doable item in `roadmap.md`, builds iOS and Mac, mirrors the fix to every platform that has the same code, commits and pushes. When the sweep and the doable roadmap items are done, bump to 3.0.0 and ship it.

## Where things stand

- iOS and Mac 2.5.18 (animated map pins, blue bulb icon) are waiting for App Review, submitted 2026-10-20. iOS 2.5.17 and Mac 2.5.16 are live.
- Sweep batches 1 to 4 are pushed and web is deployed: 43 of 45 leads closed. Two clear-search flicker nits are left.
- The new name is Apolon (Apollo in Polish and Russian, the Temida pattern): god of light and foresight. Joshua said "you decide" after Chrysus was rejected and Plouton turned out to be another app's. The store name changes with 3.0.0.
- Epiphany Sans is in `fonts/` and `brand/` but no screen uses it yet.
- Ship gotchas: `ios/ExportOptions.plist` now exports an IPA so `asc workflow run ship-ios` can publish it. Submit fails until What's New is set on the en-CA locale. Watch has no ship workflow.

## Next, in order

1. Apolon theme, Hermes as the reference: new glyph, Apolon Sans (from Epiphany Sans) with themed quote marks, an OFL display face, public domain art on the landing, display names and docs. Bundle IDs, keys, App Group and Swift type names stay.
2. Re-probe the name right before the 3.0.0 submit.
3. Wire Apolon Sans into iOS, Mac and web.
4. Roadmap items that need no one: MapSourcesSettingsView (wire or delete), web Places fallback when Overpass is down, macOS sign-in and onboarding sheet overlap.
5. Bump to 3.0.0 on iOS, Mac, Watch and web, set What's New, ship iOS and Mac, deploy web.

## Restart prompt

```
/loop to next major semver: read docs/LOOP-HANDOFF.md, do the next item in "Next, in order", build iOS and Mac (look for BUILD SUCCEEDED), mirror to every platform with the same code, commit and push, update this file.
```
