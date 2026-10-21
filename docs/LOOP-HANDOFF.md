# Epiphany loop handoff (2026-10-21, late morning)

## What the loop is

Work Epiphany one batch at a time. Each pass fixes a batch from `docs/reference/code-sweep-2026-10-04.md` or a doable item in `roadmap.md`, builds iOS and Mac, mirrors the fix to every platform that has the same code, and commits. Commits stay local until Joshua says push.

## Where things stand

- The last iPhone store release shipped the old icon: only the root icon bundle had been swapped. The iOS, Mac and Watch `.icon` bundles now carry the lyre.
- A 3.0.1 iPhone build with the lyre is uploaded, not submitted. The store needs What's New text for en-CA first.
- Mac 3.0.0 is WAITING_FOR_REVIEW (submitted 2026-10-20). The Watch build has no ship workflow.
- Commit a6cfec0 is local only. It carries the income and debt fix (real income set, old debt removed, so web and phone agree), People search falling back to Wikipedia when Google's search API comes back empty, the mean-reverting six-month spending forecast, thinner iPhone chart month labels, and one sans type: San Francisco on Apple, Lato under the Epiphany Sans name elsewhere. The all-caps Tenor display face is dropped. The push and web deploy are blocked on Joshua.
- Sweep done: all 45 leads closed.
- The name stays Epiphany. The Apollo theme stays: lyre icon, laurel-leaf quotes, brand kit at /brand.
- Ship gotchas: `ios/ExportOptions.plist` exports an IPA so `asc workflow run ship-ios` can publish it. Submit fails until What's New is set on the en-CA locale.

## Next, in order

1. Wait for App Review on Mac 3.0.0. If Apple rejects it, reply with the reasons first; do not resubmit unchanged.
2. Brand kit: swap the Apollo statue art for an image that reads as a god of epiphanies (Joshua's ask, 2026-10-21).
3. Roadmap items that need no one: MapSourcesSettingsView (wire or delete), web Places fallback when Overpass is down, macOS sign-in and onboarding sheet overlap.

Blocked on Joshua, do not do without a yes: submit iPhone 3.0.1; push a6cfec0 and deploy the web.

## Restart prompt

```
/loop next release: read docs/LOOP-HANDOFF.md, do the next item in "Next, in order" that needs no one, build iOS and Mac (look for BUILD SUCCEEDED), mirror to every platform with the same code, commit locally. Do not push or submit to the App Store without Joshua's yes. Update this file.
```
