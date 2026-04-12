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
- `CLAUDE.md` — update web URL to epiphany.heyitsmejosh.com or monica.heyitsmejosh.com
- `icon.svg` — refresh for Epiphany brand
- `architecture.svg` — update node diagram

## 6. Security audit
See security checklist in `~/.claude/plans/adaptive-plotting-newell.md` §10.
Key areas: session token entropy, bcrypt rounds, rate limiting on `/api/auth`, KV key enumeration, Stripe webhook sig verification.
