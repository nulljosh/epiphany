# Monica

v4.2.0 -- Personal intelligence platform. Palantir for regular people.

## Rules

- Map stays steady -- no jumps on load, no flashing on state changes
- No fake prices before real data arrives
- Mobile-first layout
- iOS app: four tabs (Map, Markets, People, Settings)
- Web app: monica.heyitsmejosh.com
- AI endpoint requires ANTHROPIC_API_KEY env var on Vercel
- Never use raw `setInterval` for API polling -- always use `useVisibilityPolling` from `src/hooks/useVisibilityPolling.js`

## Run

```bash
npm install && npm run dev
npm test -- --run
npm run build
```

Deploy: Vercel. Repo: github.com/nulljosh/monica

## Key Systems

- **Gateway**: `api/gateway.js` -- critical routes static-imported; everything else lazy-loaded
- **Auth**: `server/api/auth.js`, `server/api/auth-helpers.js`
- **AI**: `server/api/ai.js` (streaming + 10 tools), `src/hooks/useAi.js`, `src/components/AiPanel.jsx`
- **Map**: `src/components/LiveMapBackdrop.jsx` (11 data layers, MapLibre GL)
- **KV**: `server/api/_kv.js` (Upstash Redis)
- **Roadmap**: `ROADMAP.md`
