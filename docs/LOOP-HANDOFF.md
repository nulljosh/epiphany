# Epiphany loop handoff (2026-10-20, late morning)

## What the loop is

Work Epiphany toward its next major version, 3.0.0. Each pass fixes a batch from `docs/reference/code-sweep-2026-10-04.md` or a doable item in `roadmap.md`, builds iOS and Mac, mirrors the fix to every platform that has the same code, commits and pushes. When the sweep and the doable roadmap items are done, bump to 3.0.0 and ship it.

## Where things stand

- iOS and Mac 2.5.18 (animated map pins, blue bulb icon) are waiting for App Review, submitted 2026-10-20. iOS 2.5.17 and Mac 2.5.16 are live.
- Sweep batches 1 to 3 are pushed: 35 of 45 leads closed. Ten left, mostly Mac and web search and places polish.
- Joshua wants a Greek god rename and theme for 3.0.0, with Hermes as the reference. Chrysus was rejected ("name sucks keep trying"). Free on Apple so far: Plutone, Atenea, Prometeo, Delphoi, Pythion, Coeus, Lachesis. Nothing is renamed until he grades a name A+. The store name can only change on the 3.0.0 version, because 2.5.18 is in review.
- Atlin's store listing reads "Pistis" from an old name probe; the rename back to Atlin was blocked by the permission check, so Joshua runs it.
- Epiphany Sans is in `fonts/` and `brand/` but no screen uses it yet.
- Ship gotchas: `ios/ExportOptions.plist` now exports an IPA so `asc workflow run ship-ios` can publish it. Submit fails until What's New is set on the en-CA locale. Watch has no ship workflow.

## Next, in order

1. Find a Greek god name Joshua grades A+, then do the theme like Hermes: new glyph, <Name> Sans with a themed quote mark, an OFL display face, public domain art on the landing, display names and docs. Bundle IDs, keys, App Group and Swift type names stay.
2. Last sweep leads: Mac search clear and Escape, Mac bbox for incidents and traffic, web Places panel close, web search Escape and suggestion pick, OSM attribution, clear-search flicker.
3. Wire Epiphany Sans into iOS, Mac and web.
4. Roadmap items that need no one: MapSourcesSettingsView (wire or delete), web Places fallback when Overpass is down, macOS sign-in and onboarding sheet overlap.
5. Bump to 3.0.0 on iOS, Mac, Watch and web, set What's New, ship iOS and Mac, deploy web.

## Restart prompt

```
/loop to next major semver: read docs/LOOP-HANDOFF.md, do the next item in "Next, in order", build iOS and Mac (look for BUILD SUCCEEDED), mirror to every platform with the same code, commit and push, update this file.
```
