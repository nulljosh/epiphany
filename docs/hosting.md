# Hosting

## Current State

Monica is currently deployed on Vercel using:

- `vercel.json` rewrites for `/api/:path*`
- a Vercel serverless gateway at `api/gateway.js`
- Vercel cron jobs for market refresh and broker runs
- Vercel KV / Blob integrations in server routes

The Vercel project has been renamed to `monica`.

Vercel Hobby also rejects the intraday `*/5 13-20 * * 1-5` cron schedule. On the free plan, Monica can only keep the once-per-day cron jobs on Vercel. Restore the intraday refresh schedule after moving to Cloudflare Workers cron or upgrading Vercel.

## Production Deploy Policy

- Do not use production deploys as a preview environment.
- Run local checks before every production deploy:
  - `npm test -- --run src/hooks/useStocks.test.js`
  - `npm run build`
- Use `./push.sh` only from this repo and only when you intend one production deploy.
- After every deploy, manually verify:
  - logged-out first paint does not show seeded stock prices in the top ticker
  - ticker fills with live or cache-backed quotes after load
  - refresh repeats the same behavior
  - status indicator reflects `LOADING`, `LIVE`, `STALE`, or `FALLBACK` honestly

## Migration Target

Primary migration target: Cloudflare Pages + Workers.

There is now a starter Cloudflare worker scaffold in this repo. See [docs/cloudflare-migration.md](/Users/joshua/Documents/Code/monica/docs/cloudflare-migration.md) for the step-by-step move.
For the copyable version to use in other repos, see [docs/cloudflare-starter.md](/Users/joshua/Documents/Code/monica/docs/cloudflare-starter.md).

Required migration work:

- move the Vite frontend to Pages
- replace the Vercel API gateway with a Workers-compatible HTTP entrypoint
- recreate cron schedules with Workers cron triggers
- replace Vercel KV with Cloudflare KV or D1 depending on access pattern
- replace Vercel Blob with R2
- recreate SPA rewrites and `/api/*` routing in Cloudflare config

Migration constraint:

- preserve existing `/api/*` response shapes so the frontend can move hosts without product-level rewrites

## Fallback Option

Netlify is the fallback host if lower migration effort matters more than Cloudflare alignment.

That path would still require:

- porting API routes to Netlify Functions
- porting cron work to Scheduled Functions
- replacing Vercel-specific storage dependencies
