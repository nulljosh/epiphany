# Monica

v2.9.0 -- Personal intelligence platform. Palantir for regular people.

## Rules

- Map stays steady -- no jumps on load, no flashing on state changes
- No fake prices before real data arrives
- Mobile-first layout
- iOS app: three tabs (Map, Markets, Settings). Internal Swift code uses MonicaAPI
- Web app: same domain (opticon.heyitsmejosh.com until DNS updated)

## Run

```bash
npm install && npm run dev
npm test -- --run
npm run build
```

Deploy: Vercel. Repo: github.com/nulljosh/monica
