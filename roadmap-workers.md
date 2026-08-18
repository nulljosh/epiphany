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

## Route parity vs production (12 sampled)
9/12 identical. Three differ, all outbound-fetch blocks, not migration bugs:
- `crypto`, `prices` — CoinGecko rate-limits/blocks Workers egress IPs
- `fear-greed` — CNN returns 418 to Workers despite a browser User-Agent

Confirmed it's IP-based, not headers: fear-greed already sends a browser UA.

## Left
1. Decide the three blocked routes: add API keys (CoinGecko has a free keyed
   tier, keys authenticate instead of IP), swap data source, or accept degraded.
2. Exercise auth, Stripe checkout, and avatar upload (the KV blob write path).
3. Arm crons and flip DNS **in the same change** — `broker/morning-run` places
   real trades and Vercel still runs them on schedule. Never both at once.
4. Delete the Vercel project after a rollback window.
