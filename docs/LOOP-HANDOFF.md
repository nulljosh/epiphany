# Epiphany loop handoff (2026-10-20, 09:38)

## What the loop is

QA loop for Epiphany's map and icon work, now paused at a release. Map venue pins spring in when they appear and bounce up with a white ring when tapped, and Reduce Motion turns the motion off. MapKit already draws venue names, so an extra name label was removed after QA showed every name twice. QA ran as a throwaway XCUITest in the iOS simulator, deleted afterwards, and the screenshots went to Joshua.

## Where things stand

- 2.5.18 is bumped on iOS, Mac and Watch (build 202610201000). The web package is 2.6.3 and is deployed with wrangler. The What's New card is updated.
- iOS and Mac build clean. 564 web tests pass.
- New icon: a white light bulb whose filament is a rising price line, on a blue gradient (#5aaeff to #1462e0). The brand kit, Epiphany.icon, icon.svg and favicons are regenerated, and the iOS, Mac and Watch asset catalogs are re-sliced. The live site serves the blue favicon (verified).
- Epiphany Sans: Manrope (SIL OFL) renamed, proportional spacing with tabular figures, curly quotes redrawn as four point sparks. `scripts/gen_font.py` builds `fonts/` (four weights, ttf and woff2, OFL.txt). It is wired into `brand/tokens.css` and `brand/BRAND.md` only.
- Pushed: ab46e7d, 0997771, a215951, b823041.
- Not done: the 2.5.18 native builds are not archived, uploaded or submitted to App Store Connect.

## Next, in order

1. After Joshua says yes: archive, upload and submit 2.5.18 for iOS, Mac and Watch.
2. Consider wiring Epiphany Sans into the apps and the web UI. Nothing uses it yet.
3. Then the open items in `roadmap.md`.

## Restart prompt

```
/loop Epiphany release: read docs/LOOP-HANDOFF.md and the top of roadmap.md, then do the next item in order. Stop before any App Store Connect upload or submit and ask Joshua for a yes first. Test in the simulator with a throwaway UI test that gets deleted after, never claim a fix without a screenshot, one subagent at a time.
```
