# Opticon

v2.6.0

## Rules

- Map stays steady -- no jumps on load, no flashing on state changes
- No fake prices before real data arrives
- Mobile-first layout, same-tab toggle opens/closes sheet
- Simulator stays centered, does not push the map

## Run

```bash
npm install && npm run dev
npm test -- --run
npm run build
```

Deploy: Vercel. Cloudflare migration planned (API first).
