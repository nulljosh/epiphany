# Cloudflare Starter

This is the small pattern to reuse in other projects.

## The pattern

- keep the frontend as a normal static app
- put one worker in front of `/api/*`
- run the easy read-only routes in that worker first
- send everything unfinished back to the current live site
- move storage and timed jobs later
- switch the real domain only after preview parity

## Which repos use which version

### Static frontend only

Use this for apps like `brief`.

What to copy:

- Cloudflare Pages setup only
- no worker unless the app later grows an API

### Frontend plus light API

Use this for apps like `spark`.

What to copy:

- `wrangler.jsonc`
- `cloudflare/worker.js`
- `cloudflare/runtime-adapter.js`
- one short migration note

What to move first:

- read-only routes
- public routes

What can wait:

- sign-in flows
- writes
- background jobs

### Frontend plus heavier API and timed jobs

Use this for apps like `monica` and `tally`.

What to copy:

- the full starter from this repo
- the route map pattern
- the proxy fallback pattern
- the migration doc structure

What to move first:

- read-only live data routes

What to move later:

- stored data
- timed refresh jobs
- sign-in and billing

## Files to copy

From `monica`, copy only these ideas and files:

- `wrangler.jsonc`
- `cloudflare/worker.js`
- `cloudflare/runtime-adapter.js`
- `docs/cloudflare-migration.md`

Then change:

- the worker name
- the fallback live host
- the local route list
- the frontend API base URL

Do not copy Monica's route list or storage assumptions line for line.

## Default workflow

1. keep local development as the fast loop
2. deploy the worker when you need online API testing
3. deploy Pages when you need a shareable frontend preview
4. avoid full production deploys for tiny changes
