# Epiphany

v1.1.1 -- Personal intelligence platform. Palantir for regular people.

## Rules

- Map stays steady -- no jumps on load, no flashing on state changes
- No fake prices before real data arrives
- Mobile-first layout
- Dark mode only, no light/auto theme
- iOS app: four tabs (Map, Markets, People, Settings)
- Web app: epiphany.heyitsmejosh.com
- AI endpoint requires ANTHROPIC_API_KEY env var on Vercel
- Never use raw `setInterval` for API polling -- always use `useVisibilityPolling` from `src/hooks/useVisibilityPolling.js`

## Run

```bash
npm install && npm run dev
npm test -- --run
npm run build
```

Deploy: Vercel. Repo: github.com/nulljosh/epiphany

## Key Systems

- **Gateway**: `api/gateway.js` -- critical routes static-imported; everything else lazy-loaded
- **Auth**: `server/api/auth.js`, `server/api/auth-helpers.js`
- **AI**: `server/api/ai.js` (streaming + 10 tools), `src/hooks/useAi.js`, `src/components/AiPanel.jsx`
- **Map**: `src/components/LiveMapBackdrop.jsx` (11 data layers, MapLibre GL)
- **KV**: `server/api/_kv.js` (Upstash Redis) -- trims env var whitespace at load; wraps get/set/del to catch UrlError; always import via getKv(), never @vercel/kv directly
- **Stocks**: `server/api/stocks-free.js` -- FMP batch (price/volume), Yahoo v7 supplement (P/E, mkt cap, EPS, beta, yield when FMP omits them). Cache key `stocks:free:v2:*`. Web + watchOS use this; iOS/macOS use `server/api/stocks.js`.
- **Avatar**: `server/api/avatar.js` -- accepts JPEG or SVG (`format: 'svg'`), stores to Vercel Blob. Web generates 8-bit pixel art SVG; iOS/macOS use photo picker JPEG.
- **Landing Page**: `src/pages/LandingPage.jsx` + `src/pages/landing.css` -- shown to unauthenticated visitors before auth flow. Fraunces serif headlines, animated node-graph canvas, scrolling ticker, feature/pricing sections. Gate in `App.jsx` via `showLanding` state.
- **Roadmap**: `ROADMAP.md`
