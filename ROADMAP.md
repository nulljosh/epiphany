# Monica Roadmap

## Active

### Rename: Monica → Epiphany
- Rename GitHub repo `nulljosh/monica` → `nulljosh/epiphany`
- Update Vercel project name + domain → `epiphany.heyitsmejosh.com`
- Update iOS bundle ID + display name
- Update macOS bundle ID + display name
- Update all READMEs, CLAUDE.md files, badge URLs
- Update memory entry in `~/.claude/projects/`
- Update `Code/CLAUDE.md` project list
- Decision confirmed 2026-04-10. Execute next session.

### Stripe $1/week
- Have: `server/api/stripe.js`, `server/api/stripe-webhook.js`, `user.tier` in KV
- TODO: Create price in Stripe dashboard, wire webhook to upgrade tier, add feature gates

### Data sources to add
- **Reddit** trending (added to gateway, `/api/reddit`)
- **CoinGecko** crypto prices (added to gateway, `/api/crypto`)
- **Reuters/AP wire** via NewsAPI or Mediastack
- **SEC filings** via EDGAR RSS
- **StatCan** releases, Bank of Canada rate decisions

### Dead API keys (need renewal)
- `TOMTOM_API_KEY` - 403 Forbidden. https://developer.tomtom.com/user/register
- `HERE_API_KEY` - 401 Unauthorized. https://platform.here.com/sign-up
- `FIRMS_MAP_KEY` - higher-res wildfire data. https://firms.modaps.eosdis.nasa.gov/api/area/
- `TICKETMASTER_API_KEY` - local events. https://developer.ticketmaster.com/
- `FMP_API_KEY` - stock data. https://site.financialmodelingprep.com/developer/docs
- `BLOB_READ_WRITE_TOKEN` - breaks `/api/latest`

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
