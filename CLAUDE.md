# Epiphany

Personal intelligence platform (map, markets, portfolio, brokerage sync). Palantir for regular people.
Web: epiphany.heyitsmejosh.com. iOS/macOS: ASC 6779522175. Roadmap and changelog live in `roadmap.md` — don't duplicate them here.

## Rules
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
- **Gateway**: `api/gateway.js` — critical routes static-imported; everything else lazy-loaded
- **Auth**: `server/api/auth.js`, `server/api/auth-helpers.js`
- **Map**: `src/components/LiveMapBackdrop.jsx` (MapLibre GL, many data layers)
- **KV**: `server/api/_kv.js` (Upstash Redis), always import via `getKv()`, never `@vercel/kv` directly
- **Stocks**: `server/api/stocks-free.js` (web + watchOS), `server/api/stocks.js` (iOS/macOS). Yahoo v10 quoteSummary; optional `FMP_API_KEY` overrides
- **Brokerage sync**: `server/api/broker/sync.js`, SnapTrade read-only. Needs `SNAPTRADE_CLIENT_ID` + `SNAPTRADE_CONSUMER_KEY` as Cloudflare Worker secrets
- **Landing page**: `src/pages/LandingPage.jsx` + `landing.css`, shown to unauthenticated visitors

## Monetization
Ambient layer (map, events, news, markets) stays free; autopilot trading, Daily Brief, and People graph are the paid gates in `server/api/gates.js`. Gate is currently open to everyone (`EPIPHANY_REQUIRE_PRO` unset) — no feature is actually paywalled in production. Only entitlement path is Stripe on web; no IAP exists in ASC yet (Guideline 3.1.1 exposure, see `notes/2-1-b-business-model-reply.md`).
