<div align="center">

# Opticon

<img src="icon.svg" alt="Opticon" width="120" />

Financial terminal and situation monitor.

[opticon.heyitsmejosh.com](https://opticon.heyitsmejosh.com)

</div>

![version](https://img.shields.io/badge/version-v2.2.0-blue)

## Architecture

![Architecture](architecture.svg)

## Stack

- React 19, Vite, MapLibre GL
- Vercel serverless gateway (25+ routes)
- Vercel KV (auth, sessions, portfolio)
- FMP + Yahoo Finance (stock data)
- Polymarket, GDELT, USGS, CoinGecko
- Stripe (billing)

## Dev

```bash
npm install && npm run dev   # localhost:5173
npm test -- --run && npm run build
./push.sh                    # run checks + one production Vercel deploy
```

## Hosting

Current production is still Vercel-native. Deploy guidance and the Cloudflare migration target are documented in [docs/hosting.md](/Users/joshua/Documents/Code/opticon/docs/hosting.md).
The top stock ticker now stays empty for a moment on first load and only fills in once real prices are ready.

## Roadmap

Use this section as the execution brief for Codex.

### Status (March 10, 2026)

- [x] Verify live market data end-to-end.
  Done: the top stock ticker no longer shows old built-in prices while the page is loading.
  Done: stock polling now runs for everyone, not just signed-in users.
  Verify: production is live at [opticon.heyitsmejosh.com](https://opticon.heyitsmejosh.com) for a manual check in the browser.

- [x] Verify polling and freshness behavior for every live API surface.
  Done: normalized freshness/degraded metadata across stocks, markets, weather, flights, incidents, earthquakes, news, events, weather alerts, local events, and crime routes.
  Done: verified current polling intervals in hooks/components: `useLivePrices` 5s, `usePolymarket` 30s, `useStocks` 60s, `useWeather` 10m, `useSituation` flights 15s / traffic 60s / broader situation 5m, `LiveMapBackdrop` 2m.
  Verify: targeted tests passed for the route freshness contracts and stale/degraded fallback behavior.

- [x] Tighten location-based monitoring coverage.
  Done: local monitoring routes now return explicit degraded/stale/cache state instead of silent empty responses when upstream sources fail.
  Verify: targeted tests cover a major-city path (`Vancouver`) and a small-town path (`Hope`) for [server/api/local-events.js](/Users/joshua/Documents/Code/opticon/server/api/local-events.js) and [server/api/crime.js](/Users/joshua/Documents/Code/opticon/server/api/crime.js).

- [x] Fix only high-confidence bugs found while doing the checks above.
  Done: fixes were limited to response freshness/status contracts and stale-cache fallback behavior in live monitoring routes.
  Verify: `vitest` roadmap suites passed and `vite build` passed.

### Codex Prompt

```text
Repo: /Users/joshua/Documents/Code/opticon

Read the Roadmap section in README.md and execute it in order.
Constraints:
- high-confidence fixes only
- verify each change with targeted tests or direct local checks
- do not expand scope beyond live API validation, polling/freshness, and location coverage
- summarize exactly what changed and what remains
```

## License

MIT 2026, Joshua Trommel

## Quick Commands
- `./scripts/simplify.sh` - normalize project structure
