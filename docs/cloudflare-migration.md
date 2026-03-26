# Cloudflare Migration

## TL;DR

Cloudflare can be a better daily workflow than Vercel for Monica, but only if you stop treating every git push like a production deploy.

Important nuance:

- Cloudflare Pages free plan gives you `500` builds each month, not unlimited pushes
- the real quality-of-life win is using a Cloudflare worker for the API and only shipping the frontend when you actually want to
- that means faster iteration with less pressure than Vercel's `100` production deploys a day, but it is not magic unlimited hosting

Official docs:

- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Workers pricing and limits](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare cron triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

## What is in this repo now

This repo now includes a first Cloudflare scaffold:

- `cloudflare/worker.js` -- API worker entry
- `cloudflare/runtime-adapter.js` -- turns a Cloudflare request into the request and response style our current handlers use
- `wrangler.jsonc` -- starter worker config
- `docs/cloudflare-starter.md` -- small copy guide for other repos

What it does today:

- runs a read-only group of local API routes directly on Cloudflare
- sends any unsupported route back to the current Vercel production site

That means you can migrate in stages instead of doing a big cutover.

## Routes that can move first

These routes are the best first wave because they mostly just fetch live data and do not depend on Vercel-only storage:

- `/api/markets`
- `/api/stocks`
- `/api/stocks-free`
- `/api/weather`
- `/api/weather-alerts`
- `/api/news`
- `/api/events`
- `/api/earthquakes`
- `/api/flights`
- `/api/incidents`
- `/api/local-events`
- `/api/crime`
- `/api/history`
- `/api/prices`
- `/api/traffic`
- `/api/commodities`
- `/api/macro`
- `/api/validate-link`

Routes still expected to stay on Vercel for now:

- auth
- portfolio and watchlist
- alerts
- cron cache writer
- latest cache reader
- Stripe routes
- webhook routes

## What still needs to be replaced

Before a full cutover, these Vercel pieces still need a Cloudflare home:

- Vercel KV
  Move this to Cloudflare KV for simple key-value data.

- Vercel Blob
  Move this to R2 for cached result files.

- Vercel cron jobs
  Move these to Cloudflare cron triggers so the intraday refresh schedule can come back.

## Recommended migration order

### 1. Bring up the API worker first

1. Create a Cloudflare account and install Wrangler.
2. From this repo, run:

```bash
npm install --save-dev wrangler
npx wrangler login
npx wrangler deploy
```

3. Save the worker URL.
4. Test a few routes directly:

```bash
curl "https://YOUR-WORKER.workers.dev/api/markets"
curl "https://YOUR-WORKER.workers.dev/api/weather?lat=49.28&lon=-123.12"
curl "https://YOUR-WORKER.workers.dev/api/news?category=business"
```

### 2. Point a frontend preview at Cloudflare

1. Create a Pages project for the frontend.
2. Build `dist` with the normal Vite build.
3. In that Pages project, set:

- `VITE_API_BASE_URL=https://YOUR-WORKER.workers.dev`

4. Deploy the frontend preview.
5. Confirm the app loads and the main live panels work.

### 3. Move storage-backed routes

After the read-only preview is stable:

1. add a Cloudflare storage helper
2. move KV-backed session and user data
3. move blob-style cache files to R2
4. update `/api/latest` and `/api/cron`
5. move auth and Stripe last

### 4. Switch production

Only switch the main domain after:

- the top ticker works
- auth works
- portfolio data works
- cron refreshes work again
- Stripe works

## What you need to do

Short version:

1. install Wrangler
2. create the Cloudflare worker
3. test the worker routes
4. create a Pages frontend preview that points at that worker
5. migrate storage and cron
6. cut over production

## Practical answer on push limits

Can you push way more to Cloudflare?

- compared with Vercel production deploys, yes, the workflow can feel much freer
- compared with unlimited git-triggered builds, no, Pages free still has a monthly build cap
- the best setup is to stop auto-deploying every tiny change and use Cloudflare for staged previews and manual releases

If you want the fastest loop, use:

- local dev for most UI changes
- worker deploys for API changes you need to test online
- Pages deploys only when you want a shareable frontend preview

## Reusing this in other repos

For the short version, read [docs/cloudflare-starter.md](/Users/joshua/Documents/Code/monica/docs/cloudflare-starter.md).
