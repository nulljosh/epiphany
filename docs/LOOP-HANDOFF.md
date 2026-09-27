# Epiphany loop handoff (2026-09-26, late evening)

## What the loop is

The native polish and submission loop is complete. No loop is running in this session.

## Where things stand

Last recorded App Store state: iOS 2.5.13 and macOS 2.5.3 submitted and WAITING_FOR_REVIEW. Native polish covers tabs, map search, relative news times, portfolio refresh, markets controls, and merchant grouping. Four stale draft submissions were cleared.

Repository organization is pushed as `48039db`. Historical files live in `docs/reference/`; generated iOS artifacts are ignored and kept locally. App code is unchanged. Validation: 518 tests passed, 2 skipped; production build passed.

## Next, in order

1. Check current App Store review status before making release decisions.
2. If rejected, read the actual rejection and address it before resubmitting.
3. Continue with open items in `roadmap.md` when requested.

## Restart prompt

Suggested prompt; the original loop command was not recorded:

```text
/loop Check Epiphany's iOS and macOS review status. Read docs/LOOP-HANDOFF.md and roadmap.md first. Report the verdict and address any rejection before resubmitting.
```
