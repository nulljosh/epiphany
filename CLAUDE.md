# Monica

v4.0.0 -- Personal intelligence platform. Palantir for regular people.

## Rules

- Map stays steady -- no jumps on load, no flashing on state changes
- No fake prices before real data arrives
- Mobile-first layout
- iOS app: four tabs (Map, Markets, People, Settings). Internal Swift code uses MonicaAPI
- Web app: monica.heyitsmejosh.com
- AI endpoint requires ANTHROPIC_API_KEY env var on Vercel
- Never use raw `setInterval` for API polling -- always use `useVisibilityPolling` from `src/hooks/useVisibilityPolling.js` (pauses when tab hidden, prevents Vercel invocation burn)

## Run

```bash
npm install && npm run dev
npm test -- --run
npm run build
```

Deploy: Vercel. Repo: github.com/nulljosh/monica

## Key Systems

- **Gateway**: `api/gateway.js` -- critical routes (auth, stocks-free, markets, latest) are static imports; everything else uses `lazy()` wrapper so one broken file can't kill all routes
- **Auth**: `server/api/auth.js` (login/register/etc), `server/api/auth-helpers.js` (session from KV), `src/components/auth.css` (shared styles)
- **AI**: `server/api/ai.js` (streaming endpoint + 10 tools), `src/hooks/useAi.js` (SSE client), `src/components/AiPanel.jsx` (chat UI)
- **Ontology**: `src/lib/ontology.js` (model), `server/api/ontology.js` (API), `src/hooks/useOntology.js` (client)
- **KV**: `server/api/_kv.js` (Upstash Redis wrapper)
- **Map**: `src/components/LiveMapBackdrop.jsx` (11 data layers, MapLibre GL). Utilities: `markerCss()` (CSS builder), `extractCoords()` (normalize lat/lon), `mapsLink()` (OSM URLs). Layers fetched in parallel every 120s. `createMarker()` validates coords before rendering.
- **Roadmap**: `ROADMAP.md` -- prioritized backlog (map layers, Stripe $1/wk, avatar sync, data sources)
