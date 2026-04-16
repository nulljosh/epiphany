# Epiphany Roadmap

## Active

### Stripe $1/week
- Have: `server/api/stripe.js`, `server/api/stripe-webhook.js`, `user.tier` in KV
- TODO: Create price in Stripe dashboard, wire webhook to upgrade tier, add feature gates

### Data sources to add
- **Reddit** trending (added to gateway, `/api/reddit`)
- **CoinGecko** crypto prices (added to gateway, `/api/crypto`)
- **Reuters/AP wire** via NewsAPI or Mediastack
- **SEC filings** via EDGAR RSS
- **StatCan** releases, Bank of Canada rate decisions

### assetmarketcap.com integration
- Integrate https://assetmarketcap.com/ into Markets view
- Add serverless route `server/api/assetmarketcap.js` to proxy/cache data
- Display in Markets tab alongside existing stock/crypto data

### Claude usage + invoices sync workflow
- Automate syncing Claude Max usage data + invoices into Epiphany
- Cron job or webhook → store in KV → display in Portfolio or a new "Costs" panel

### Dormant features (re-enable when keys available)
- Traffic layer (TOMTOM) -- https://developer.tomtom.com/user/register
- Geocoding / places (HERE) -- https://platform.here.com/sign-up
- High-res wildfire (FIRMS_MAP) -- https://firms.modaps.eosdis.nasa.gov/api/area/
- Local events (TICKETMASTER) -- https://developer.ticketmaster.com/
- FMP stock data -- https://site.financialmodelingprep.com/developer/docs
- Blob-cached latest snapshot (`/api/latest`) -- restore handler body when ready

### UI polish
- Map event UX (Republic SF-inspired filtering, event cards)
- TradingView widget embedding (Pine Scripts exist in `tradingview/`)
- Service BC location markers on map (Tally integration)
- Split App.jsx into smaller modules (1500+ lines)

### Free vs Premium ($1/wk)
| Free | Premium |
|---|---|
| Map + all data layers | AI Analyst (Claude) |
| Situation monitor (read) | Portfolio + watchlist |
| Stock data + ticker | Ontology writes + batch |
| Weather/quakes/traffic | Deep news + crime data |

## Done

- Rename: Monica → Epiphany (GitHub repo, Vercel, iOS/macOS bundle IDs, READMEs, CLAUDE.md, memory)
- STALE indicator / heartbeat
- Macro pulse strip (dynamic from `/api/macro`)
- Map layers (11 layers, coord validation, mapLayers filtering)
- Ticker (live data + static fallback)
- Avatar sync iOS/web
- Upgrade button UX (PricingPage modal)
- Error resilience (fetchJsonGraceful, iOS/macOS decode logging)
- Gateway stability (lazy() per route, try/catch isolation)
- Double star watchlist fix
- Polymarket whale tracking
- Tally payday on web
- People tabs merged (web + iOS + macOS)
- Nav flattened (Situation | Markets | Portfolio | People | Settings)
- Fake map data removed (real coords only)
- Wikipedia popup links fixed
- Repo cleanup (10 dead folders removed)
- GitHub repos cleaned (33 -> 10)
- Palantir-style icon across all platforms
- Reddit + CoinGecko data sources added
- Whitepaper written
- Dead API key cleanup (5 expired Vercel env vars removed; dead fetches stripped in fd4d5b2)
