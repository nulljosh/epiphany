![Monica iOS](icon.svg)

# Monica iOS

![version](https://img.shields.io/badge/version-v1.0.0-blue)

Your personal intelligence layer. Monica watches everything happening around you -- markets, events, weather, crime, traffic -- and puts it all on one map. Think of it as having a friend who always knows what's going on.

![Architecture](architecture.svg)

## What it does

- **Map** -- your home screen. Shows everything happening nearby: local events, construction, weather alerts, flights overhead, crime reports, traffic incidents. The more you zoom in, the more you see.
- **Markets** -- stocks, crypto, commodities, all in one list. Your portfolio summary sits at the top with a timeline showing when your debts get paid off and when payday hits. Tap any stock for charts, fundamentals, and related news.
- **Settings** -- profile, subscription, map source toggles, Tally connection.

## Where it's going

Monica is becoming a full intelligence platform. The map is just the beginning.

- **More data, everywhere** -- gas stations with live prices, restaurant wait times, parking availability, public transit delays. If it's happening nearby, Monica should know about it.
- **People search (v1.1.0)** -- the third pillar. Search anyone by name and get a structured profile from public sources. Google aggregation, social discovery (LinkedIn, Facebook, X, Instagram, GitHub), public records (property, court, business). Profile cards with photo, bio, links, news mentions. Local cache for instant recall. Future: relationship mapping and network visualization.
- **Predictions** -- not just what's happening now, but what's about to happen. Event forecasting, price movement predictions, weather pattern analysis.
- **Alerts** -- price alerts for stocks, area alerts for crime/weather, custom triggers for anything Monica tracks.

Basically: Palantir for normal people.

## Run

```bash
# Open in Xcode, run on simulator or device.
# Backend env vars: FMP_API_KEY, FRED_API_KEY.
```

## Changelog

### v1.0.0 "Monica" (2026-03-25)
- Renamed from Opticon to Monica
- New white app icon (Wealthsimple-inspired M + chart mark)
- Map events fix: local events now properly show on map (lng coordinate decode)
- Added Ticketmaster as event source, improved OSM venue queries
- Better incident data: construction, emergency services, police stations instead of random bollards
- Stock detail: market cap, P/E, EPS now show via FMP profile fallback
- Related news: smarter matching with company name aliases (Apple for AAPL, etc.)
- Profile name: set and change your display name in settings
- Markets performance: deferred heavy loads, market data renders first
- Error handling: map errors auto-dismiss after 5 seconds

### v4.0.0 "Snow Leopard" (2026-03-25)
- Three tabs (Map, Markets, Settings), removed standalone Portfolio tab
- Portfolio data merged into Markets as collapsible section
- In-app news reader via SFSafariViewController
- Map is the default home screen

### v3.1.0 (2026-03-24)
- Map: crime, local events, traffic data layers
- Stock detail: company name in header
- Tally: hardened error handling

### v3.0.0 (2026-03-21)
- Sign in with Apple, clrs.cc palette, security hardening

### v2.10.0 (2026-03-21)
- Polymarket, FRED macro indicators, news aggregation

### v2.7.0 (2026-03-21)
- Trading simulator with Kelly criterion

## License

MIT 2026 Joshua Trommel
