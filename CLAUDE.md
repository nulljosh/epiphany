# Epiphany

Personal intelligence platform (map, markets, portfolio, brokerage sync). Palantir for regular people.
Web: epiphany.heyitsmejosh.com. iOS/macOS: ASC 6779522175. Roadmap and changelog live in `roadmap.md` — don't duplicate them here.

## Rules
- All changes must cover every applicable platform in the same session: web, iOS, macOS, Android, Windows/Linux, and watchOS. Check each client; explicitly report where a feature does not exist.
- Map stays steady — no jumps on load, no flashing on state changes
- No fake prices before real data arrives
- Mobile-first layout
- Web: dark only (Gotham brand, hardcoded dark surfaces). Native (iOS/macOS/watchOS): follows system appearance via adaptive `Palette`
- iOS app: four tabs (Situation, Markets, Portfolio, Settings)
- Never use raw `setInterval` for API polling — always use `useVisibilityPolling` from `src/hooks/useVisibilityPolling.js`

## Run
```bash
npm install && npm run dev
npm test -- --run
npm run build
```
Deploy: Cloudflare Workers, `npm run build && npx wrangler deploy`. No CI auto-deploy on push, `.github/workflows/test.yml` only runs tests. Repo: github.com/nulljosh/epiphany

## Key systems
Historical PDFs, the old screenshot, and Cloudflare migration notes live in `docs/reference/`. Current work stays in `roadmap.md`. Web assets live in `public/`; native clients and release tooling stay in their platform directories.

- **Gateway**: `api/gateway.js` — critical routes static-imported; everything else lazy-loaded
- **Auth**: `server/api/auth.js`, `server/api/auth-helpers.js`
- **Map**: `src/components/LiveMapBackdrop.jsx` (MapLibre GL, many data layers)
- **KV**: `server/api/_kv.js` (Upstash Redis), always import via `getKv()`, never `@vercel/kv` directly
- **Stocks**: `server/api/stocks-free.js` (web + watchOS), `server/api/stocks.js` (iOS/macOS). Yahoo v10 quoteSummary; optional `FMP_API_KEY` overrides
- **Brokerage sync**: `server/api/broker/sync.js`, SnapTrade read-only. Needs `SNAPTRADE_CLIENT_ID` + `SNAPTRADE_CONSUMER_KEY` as Cloudflare Worker secrets
- **Landing page**: `src/pages/LandingPage.jsx` + `landing.css`, shown to unauthenticated visitors

## Monetization
Web is freemium: Free is delayed quotes, basic indicators and one portfolio; Premium ($1 once, Stripe) adds real-time quotes, the full indicator suite, price alerts, People, Daily Brief and extra brokerage links. The iOS, Mac and Watch apps are a $1 App Store purchase that unlocks everything. Gates live in `server/api/gates.js` (server, enforced) and `src/context/PremiumContext.js` (web UI). The app is told from a browser by its URLSession User-Agent, and the account is marked `nativeApp` so the autopilot cron, which has no request, still treats it as paid. `EPIPHANY_REQUIRE_PRO=false` is the escape hatch that opens every gate. Details in the memory note on the pricing model.

## The loop

Current handoff and restart guidance: [docs/LOOP-HANDOFF.md](docs/LOOP-HANDOFF.md). The native submission loop is complete; verify current review status before resuming.
