# Epiphany

Map, markets, portfolio and people on one screen. Web at epiphany.jaybulb.com, iOS and macOS at ASC 6779522175. Open work lives in `roadmap.md`.

## Rules
- Cover every client in the same change: web, iOS, macOS, watchOS. Say where a feature does not exist.
- The map stays steady: no jumps on load, no flashing.
- No fake prices before real data arrives.
- Mobile first. Native apps follow system appearance through `Palette`.
- Poll with `useVisibilityPolling`, never a raw `setInterval`.
- KV through `getKv()` in `server/api/_kv.js`.

## Run
```bash
npm install && npm run dev
npm test -- --run
npm run build && npx wrangler deploy
```
A push deploys nothing. CI only runs tests. Native ships with `asc workflow run ship-ios VERSION:x.y.z` (and `ship-mac`); set What's New per locale first.

## Where things are
- `worker/index.js`: Worker entry and crons. `api/gateway.js` routes to `server/api/`.
- `server/api/auth.js`: sign-in. `server/api/gates.js`: paid gates (`EPIPHANY_REQUIRE_PRO=false` opens them).
- `server/api/broker/sync.js`: SnapTrade, read only.
- `src/components/LiveMapBackdrop.jsx`: the map. `src/pages/LandingPage.jsx`: the landing.
- `Shared/`: Swift code shared by iOS and macOS. Each app has its own folder and `project.yml`.
- `scripts/kv-portfolio-edit.sh`: read or merge a user's portfolio in KV.
- Docs: `docs/` (API, ARCHITECTURE, LOOP-HANDOFF). Old notes: `docs/reference/`.

## Versioning
Semver, honestly. A feature is a minor (5.1.0), a fix is a patch (5.1.1), a major only for a big change to how the app works (a redesign, a new tab, trading) and only on Joshua's call. Never one major per roadmap row and never a loop target like "to v110": loops run to the end of a list, not to a number. The 5.0.0 to 102.0.0 commits were that mistake; App Store 5.0.0 ships them together.

## The loop
Handoff and restart prompt: [docs/LOOP-HANDOFF.md](docs/LOOP-HANDOFF.md).

## Money
Web is free with a $1 Stripe Premium. The apps are a $1 App Store purchase. The server tells the app from a browser by its User-Agent and marks the account `nativeApp`.
