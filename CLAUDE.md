# Monica

v3.5.0 -- Personal intelligence platform. Palantir for regular people.

## Rules

- Map stays steady -- no jumps on load, no flashing on state changes
- No fake prices before real data arrives
- Mobile-first layout
- iOS app: four tabs (Map, Markets, People, Settings). Internal Swift code uses MonicaAPI
- Web app: monica.heyitsmejosh.com
- AI endpoint requires ANTHROPIC_API_KEY env var on Vercel

## Run

```bash
npm install && npm run dev
npm test -- --run
npm run build
```

Deploy: Vercel. Repo: github.com/nulljosh/monica

## Key Systems

- **Ontology**: `src/lib/ontology.js` (model), `server/api/ontology.js` (API), `src/hooks/useOntology.js` (client)
- **AI**: `server/api/ai.js` (streaming endpoint + 10 tools), `src/hooks/useAi.js` (SSE client), `src/components/AiPanel.jsx` (chat UI)
- **Gateway**: `api/gateway.js` routes all `/api/*` to `server/api/*.js`
- **Auth**: `server/api/auth-helpers.js` (session from KV), `server/api/auth.js` (login/register/etc)
- **KV**: `server/api/_kv.js` (Upstash Redis wrapper)
