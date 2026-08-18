# Epiphany → Cloudflare Workers

Deployed for verification at https://epiphany.trommatic.workers.dev
Production DNS still points at Vercel. Nothing has been cut over.

## Done
- `worker/index.js`: assets binding + a Vercel `(req,res)` → `Response` adapter
  over the existing `api/gateway.js`. No handler rewrites.
- Workers, not Pages: Pages Functions can't run Cron Triggers and this app has 3.
- Bundle got under the 3MB limit (was 2.99MB, now 2.10MB): `defuddle.js` was
  pulling jsdom (~20MB) into the runtime — swapped for `linkedom`, so Readability
  sees the same DOM and extraction output is unchanged.
- `node:net` → regex predicates; `node:dns` → Cloudflare DoH (SSRF guard kept).
- `server/api/_blob.js` replaces `@vercel/blob` over Workers KV (R2 is
  dashboard-only to enable). Worker serves `/api/blob/<key>` so the `url` values
  callers persist stay resolvable. Round-trip verified.
- 33 secrets uploaded via `wrangler secret bulk`.

## Gotcha worth remembering
`vercel env pull` writes values that end in a real newline as a literal `\n`
**inside the quotes**. Naive parsing keeps those two characters. Nine secrets
were corrupted this way on first upload — including `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET`. `_kv.js` calls `.trim()`, which hides it on Vercel
(real newline) but not here (backslash + n). Always `unicode_escape`-decode
before uploading, and ping the provider afterwards.

## Route parity vs production
14/14 sampled routes match. The three egress-blocked routes are fixed:
- `crypto` -> Kraken fallback when CoinGecko refuses (keyless, no IP gate)
- `prices` -> Coinbase spot fallback, 24h change derived from yesterday's spot
- `fear-greed` -> CNN has no keyed tier or free equivalent for the *stock*
  index, so a good response is cached in KV and served stale; a cold cache
  returns an explicit empty state instead of a 502, which the widget handles.

CoinCap v2 is dead (connection refused) — don't reach for it.
`stocks-free` flaps 500 occasionally on upstream rate limits; it does the same
on Vercel, so it is pre-existing, not a migration regression.

## Left
1. Exercise auth, Stripe checkout, and avatar upload (the KV blob write path).
3. Arm crons and flip DNS **in the same change** — `broker/morning-run` places
   real trades and Vercel still runs them on schedule. Never both at once.
4. Delete the Vercel project after a rollback window.
