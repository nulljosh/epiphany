# Epiphany API

Base URL: `https://epiphany.heyitsmejosh.com/api`

Every route is served by one Cloudflare Worker (`worker/index.js`) which hands
`/api/*` to the gateway in `api/gateway.js`. The path after `/api/` is the route
name, so `/api/broker/positions` maps to `server/api/broker/positions.js`.

Responses are JSON. Errors are `{ "error": "message" }` with the matching HTTP
status.

## Authentication

Session auth over an HTTP-only cookie. Sign in first, then send the cookie on
subsequent calls:

```bash
curl -c jar.txt -X POST https://epiphany.heyitsmejosh.com/api/auth \
  -H 'Content-Type: application/json' \
  -d '{"action":"login","email":"you@example.com","password":"..."}'

curl -b jar.txt https://epiphany.heyitsmejosh.com/api/watchlist
```

From a browser on the same origin, `fetch(url, { credentials: 'include' })` is
enough. Routes marked **auth** return `401` without a valid session; everything
else is open.

Requests whose `User-Agent` looks like a crawler (`bot`, `spider`, `GPTBot`,
`ClaudeBot`, …) get `403`. Use a normal client UA, or the WebMCP tools below,
which run inside the page and are not filtered.

## User data (auth)

| Route | Methods | Notes |
|---|---|---|
| `/auth` | POST | `action`: `login`, `register`, `logout`, `me`, `change-password`, `change-email`, `change-name` |
| `/watchlist` | GET, POST, DELETE | POST `{symbol}`; DELETE `?symbol=AAPL` |
| `/alerts` | GET, POST, DELETE | POST `{symbol, targetPrice, direction}` where direction is `above`/`below`; DELETE `?id=` |
| `/portfolio` | GET, POST | GET returns accounts, holdings and net worth; POST replaces manual accounts |
| `/portfolio/history` | GET | Net-worth time series |
| `/ontology` | GET, POST, DELETE | Personal entity graph |
| `/people`, `/people-index`, `/people-crossref`, `/people-import` | GET, POST | Contact records |
| `/statements` | GET, POST | Uploaded statement parsing |
| `/avatar` | POST | Generates an avatar for the signed-in user |
| `/stripe` | POST | Checkout and billing portal sessions |
| `/history`, `/signals`, `/gates`, `/latest` | GET | Saved runs and signal history |

## Brokerage (auth)

| Route | Methods | Notes |
|---|---|---|
| `/broker/positions` | GET | Live positions from the linked broker |
| `/broker/sync` | POST | Pull fresh holdings |
| `/broker/signal`, `/broker/ws-signal` | GET | Current trade signals |
| `/broker/morning-run` | POST | Runs the morning strategy pass (also on cron) |
| `/broker/impact-test` | POST | Dry-run a strategy change |
| `/broker/autopilot` | POST | `{enabled}` — **places real trades when enabled** |
| `/broker/disconnect` | POST | `{broker}` — unlinks the account |
| `/broker/wealthsimple-auth`, `/broker/alpaca` | POST | Account linking |

## Market data (open)

| Route | Query | Cache |
|---|---|---|
| `/stocks-free` | `?symbols=AAPL,MSFT` | 60s |
| `/stocks` | `?symbols=` (richer, keyed provider) | — |
| `/prices` | `?symbols=` | 60s |
| `/markets` | — indices, breadth | 60s |
| `/macro` | — rates, CPI, unemployment | 1h |
| `/commodities` | — | 5m |
| `/crypto` | `?symbols=BTC,ETH` | 60s |
| `/fear-greed` | — | 5m |
| `/sp500` | — constituents | — |
| `/polymarket-whales` | — prediction-market flow | — |

## News and world data (open)

| Route | Query | Cache |
|---|---|---|
| `/news` | `?category=` | 5m |
| `/daily-brief` | — | — |
| `/reddit` | `?sub=` | 5m |
| `/weather` | `?lat=&lon=` | 5m |
| `/weather-alerts` | `?lat=&lon=` | 5m |
| `/aqi` | `?lat=&lon=` | — |
| `/earthquakes`, `/wildfires`, `/flights`, `/traffic`, `/crime`, `/incidents`, `/emergency`, `/dispatch` | `?lat=&lon=&radius=` | 2–60m |
| `/events`, `/local-events` | `?lat=&lon=` | 10m |
| `/venue-details` | `?id=` — Yelp detail | 24h |
| `/defuddle`, `/validate-link` | `?url=` — readable article text | — |

## Webhooks

`/webhook`, `/broker/webhook` and `/stripe-webhook` are signature-verified
inbound endpoints. Not for client use.

## WebMCP

When the app is open in a browser with WebMCP support, it registers its own
tools on `document.modelContext`, so an in-page agent can act without handling
cookies itself. Source: `src/lib/webmcp.js`.

Read-only: `get_watchlist`, `get_quote`, `get_market_summary`, `get_portfolio`,
`get_news`, `list_alerts`.

Reversible writes: `add_to_watchlist`, `remove_from_watchlist`,
`create_price_alert`, `delete_price_alert`.

Requires human confirmation: `set_broker_autopilot`, `disconnect_broker`.

## Rate limits

Per-IP, applied in `server/api/_ratelimit.js`. Exceeding it returns `429` with a
`Retry-After` header. Cache the open market-data routes on your side; the TTLs
above are what the edge already serves.
