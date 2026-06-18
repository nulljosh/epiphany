# design-sync — deferred to weekend (after usage reset 2026-06-20)

Status: not started. Repo has no `.design-sync/config.json` yet — first-time import.

## Why deferred
Claude usage was at 92% of weekly cap when this was scoped (2026-06-18). The
skill's first-time sync is high-fidelity (iterative build + visual verify per
component) and can take hours — risk of hitting the cap mid-run.

## What's here
`src/components/` is the whole app's component folder, not an isolated
design-system package — no `.storybook/`. The sync would run in "package"
shape, treating this folder as the design system.

## Scoping decision needed before running
Not every file in `src/components/` belongs in a design system upload —
e.g. `LoginPage.jsx`, `RegisterPage.jsx`, `TradeWorkflow.jsx`,
`SurvivalMode.jsx` are page/flow components, not reusable design-system
pieces. `ui.jsx` looks like the actual shared primitives file (buttons,
indicators, animations) — start there.

Recommend narrowing scope via `componentSrcMap` in config to genuinely
reusable pieces (ui.jsx primitives, SparklineChart, Ticker, NewsWidget,
WeatherWidget, etc.) rather than syncing the whole app's component list.

## Next steps (run this weekend)
1. Run `/design-sync epiphany project` again.
2. When asked about scope, narrow to shared/reusable components only (see
   list above) — don't sync page-level components.
3. First-time sync creates a NEW Claude Design project (no existing one to
   merge into).
4. Expect "package" shape (no Storybook found) — confirm if one exists
   elsewhere in the repo before accepting that.
5. Approve the one upload plan when asked; it's incremental, so components
   appear as they're verified — no need to wait for the whole run to finish
   in one sitting.

## Sync completed 2026-06-18
- Ran in synth-entry mode (no `module`/`main`/`exports` in package.json — this is an app, not a published package). `--entry ./src/components/ui.jsx` used so the converter could walk up to find the repo's package.json.
- Scope: 10 components from `componentSrcMap` (ui.jsx's 6 exports + SparklineChart, Ticker, NewsWidget, WeatherWidget), excluding all page/flow components per the prior scoping decision above.
- Floor cards only — no authored previews — per explicit "fastest" user choice (98% weekly usage at the time).
- Render check skipped (`--no-render-check`) — no Playwright/Chromium cached, install skipped to save time. Renders are NOT machine-verified.
- `[FONT_MISSING]`: SF Pro Display/Text referenced by `--font-primary` but not shippable (Apple-licensed). Accepted substitute (system font fallback) — recorded here per skill requirement, no further action.
- Uploaded to new Claude Design project "Epiphany UI" (projectId in config.json).

### Re-sync risks
- No render check was run — if a component visibly breaks in the DS pane, that's expected to need a manual fix, not a regression.
- Floor cards are the standing invitation to author richer previews later — `ui.jsx`'s exports are simple enough that authoring should be fast.
- `cssEntry` only carries spacing/type/radius tokens — actual component colors are inline in JSX, not tokenized. A future tokens pass could extract a real color palette if needed.
