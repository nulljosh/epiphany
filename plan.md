# Epiphany — Open Tasks

## 1. People indexer "Search failed (404)"
`src/components/PeoplePanel.jsx:1600` calls `/api/people?q=...`
Gateway routes to `server/api/people.js` (lazy). Fallback cascade: Google CSE → DuckDuckGo → Wikipedia.
**To do:** Test live endpoint, confirm lazy load succeeds. Check Vercel function logs for import errors. Env vars needed: `GOOGLE_CSE_KEY`, `GOOGLE_CSE_ID`.

## 2. Portfolio shows DEMO badge
`src/hooks/usePortfolio.js:72` — `isDemo = !customData`. Loads from localStorage first, then fetches from `/api/portfolio?action=get` when authenticated.
**To do:** Log in, open Portfolio tab, check browser console for `[portfolio]` logs. If `fetchServerPortfolio` returns null, check KV key `portfolio:{userId}` in Upstash.

## 3. Bitmap avatar — iOS
`ios/Views/SettingsView.swift` — currently uses PhotosPicker + camera.
**To do:** Replace with a "Generate" button. On tap: generate 64x64 UIImage from a seeded pixel pattern (symmetric, random palette), upload via `MonicaAPI.shared.uploadAvatar(imageData:)`. Remove PhotosPicker and CameraPickerView. Match web impl in `src/components/Settings.jsx:generateBitmapAvatar`.

## 4. Bitmap avatar — macOS
`macos/Views/SettingsView.swift` — shows initial only, no upload.
**To do:** Add "Generate avatar" button. Same pixel pattern as iOS using NSImage + NSBitmapImageRep. Upload via shared API client.

## 5. Whitepaper + README/icon/architecture refresh
- `WHITEPAPER.md` — bump to v1.0.0, update data sources table, fix nav (5 panels not 4)
- `README.md` — update with current live URL, feature list, version badge
- `CLAUDE.md` — update web URL to epiphany.heyitsmejosh.com
- `icon.svg` — refresh for Epiphany brand
- `architecture.svg` — update node diagram

## 6. Security audit
See security checklist in `~/.claude/plans/adaptive-plotting-newell.md` §10.
Key areas: session token entropy, bcrypt rounds, rate limiting on `/api/auth`, KV key enumeration, Stripe webhook sig verification.

## 7. Mac app login broken — old API URL
`macos/EpiphanyAPI.swift` — baseURL is `"https://monica.heyitsmejosh.com"`.
**To do:** Update to `"https://epiphany.heyitsmejosh.com"`. Same check needed in iOS `EpiphanyAPI.swift`.

## 8. Markets page does not render
Mac app: Markets tab shows blank. Map is only visible view. Nothing loads on map either.
**To do:** Debug Markets view init — check for nil data, missing env vars, or API URL mismatch causing silent fail on the renamed domain.

## 9. Chart data — line/heiken "No chart data available" + missing fundamentals
Most tickers fail. A few render. P/E and market cap never display.
FMP_API_KEY is dead (listed in ROADMAP.md). Yahoo batch fallback (`fetchYahooBatch`) added in `server/api/stocks-free.js` — returns fundamentals via v7/finance/quote.
**To do:** Monitor Vercel logs to confirm Yahoo batch is returning data for all symbols. If still failing, renew FMP key at financialmodelingprep.com.

## 10. Web avatar generator broken (silent failure)
**Fixed 2026-04-12:** Added `avatarVersion` state in `src/components/Settings.jsx` — sets `Date.now()` after upload to bust the URL cache regardless of whether server updates `avatarUpdatedAt`.

## 11. Web map — no live repopulation on pan/move
Map only loads events near user on startup. As user pans/moves, no new events load.
**To do:** Add `moveend` / `dragend` listener in `src/components/LiveMapBackdrop.jsx`. On bounds change, re-fetch all active data layers for new viewport bbox. Debounce 500ms.

## 12. Header still shows "monica"
**Fixed 2026-04-12:** Updated `src/layouts/DesktopLayout.jsx:33` — changed display name from "monica" to "epiphany".

## 13. UI glow on focused buttons
**Fixed 2026-04-12:** Removed `outline: 2px solid rgba(0,113,227,0.5)` from `button:focus-visible` in `src/index.css:62`.

## 14. Ticker bar — can't click, too tall
**Fixed 2026-04-12:**
- Click threshold raised from 5px → 10px (mouse) in `src/components/Ticker.jsx:140`
- Ticker wrapper capped at `maxHeight: 36` in `src/layouts/DesktopLayout.jsx:21`
