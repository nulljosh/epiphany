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

## Test suite: green (413 tests, 32 files)

The port broke CI twice before this was true, both worth not rediscovering:
- Moving `jsdom` to devDependencies with a bare `npm i -D` upgraded it
  27.4.0 -> 30.0.1; jsdom 30's nested undici needs newer Node than CI runs, so
  vitest collected 32 startup errors and ran **zero** tests. Pinned back.
- The four test files mocking the blob layer still mocked `@vercel/blob` after
  the handlers moved to `./_blob.js`, so the mocks stopped intercepting (17
  failures). Repointed, including one dynamic `await import` inside a test body.

Fixed in c9121e1.

## BLOCKER — do not flip DNS until this is resolved

~5 keys were uploaded as `[SENSITIVE]` literal strings (Vercel marked them
write-only; `vercel env pull` returns `[SENSITIVE]`, API with `?decrypt=true`
returns nothing). These must be re-entered from their provider dashboards:

- `GITHUB_CLIENT_SECRET` (GitHub)
- `GOOGLE_CLIENT_SECRET` (Google Cloud Console)
- `SNAPTRADE_CLIENT_ID` + `SNAPTRADE_CONSUMER_KEY` (SnapTrade dashboard)
- `YELP_API_KEY` (Yelp developers)

### Stale/not needed (do not re-enter)
- **OPENSKY_CLIENT_ID/SECRET** — dead. Flights via adsb.lol only (2026-06-21);
  OPENSKY never called in `server/api/flights.js`. Delete from Vercel.
- **RESEND_API_KEY** — on disk at `~/.config/fish/secrets.fish`. Re-verify
  against Resend before trusting (2026-05-02 rotation recorded in
  `reference_local_secrets_stale.md`).
- **ADMIN_EMAILS** — whitelist, almost certainly Joshua's iCloud address; wrong
  guess fails closed, not open.
- **FMP_API_KEY** — degraded, not blocking. `stocks-free` already falls back to
  Yahoo and returns real data.
- **TWITTER_CLIENT_SECRET** — 6th but Twitter was never unblocked anyway per
  `project_social_signin_rollout.md`.

### Already recovered (public by nature, no dashboard needed)
- `GITHUB_CLIENT_ID` = `0v23lidQiMB1b0upXGgC`
- `GOOGLE_CLIENT_ID` = `455155642136-apgrhdk2bc2p6gvvv029j2tsos57fcm2.apps.googleusercontent.com`
- `TWITTER_CLIENT_ID` = `VFM1NnF6OWhXdG5SU1FUNFpYME06MTpjaQ`
- `STRIPE_PRICE_ID_PRO` / `VITE_STRIPE_PRICE_ID_*` = `price_1U0KVCBmnhdgU9sGi8nOuDxo`
  ("Epiphany Pro", confirmed against the Stripe API with the working secret key)
- `SITE_URL` = `https://epiphany.heyitsmejosh.com`

Client IDs came out of production's own OAuth redirects; the price ID out of the
Stripe API. None of that needed a dashboard.

### Recovery path
Use the `get-api-key` skill (drives logged-in Chrome to scrape keys from
provider dashboards) — ~20 minute job next session.

Set them with `wrangler secret put`, then re-run the parity diff. **Status-code
parity is not sufficient evidence** — assert on response bodies for the routes
each key backs. FMP's silent fallback to Yahoo made a dead key look healthy.

## Left
1. Exercise auth, Stripe checkout, and avatar upload (the KV blob write path).
3. Arm crons and flip DNS **in the same change** — `broker/morning-run` places
   real trades and Vercel still runs them on schedule. Never both at once.
4. Delete the Vercel project after a rollback window.
