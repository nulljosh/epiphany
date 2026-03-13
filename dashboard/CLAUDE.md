# CLAUDE.md

Developer dashboard for `~/Documents/Code/` projects.

## Current State (2026-03-06)

- OpenClaw panel is enabled in the dashboard UI.
- Model switcher is enabled with a curated list (latest Codex + Claude family).
- Default model target is `openai-codex/gpt-5.4-codex`.
- Cloudflare target endpoint is `dashboard.heyitsmejosh.com` (not yet deployed -- local dev only for now).

## Key Files

- `src/App.jsx` — main dashboard component
- `src/App.css` — all styles (design tokens inline)
- `server/collect.js` — data collection module (scans git repos, gh CLI, GitHub API)
- `vite.config.js` — Vite plugin + OpenClaw API middleware for the dashboard UI

## Commands

- `npm run dev` — dev server (port 5173, data refreshes live)
- `npm run build` — production build to dist/

## Notes

- `server/collect.js` uses `gh` CLI for Actions/Vercel status.
- Filters: `all`, `today`, `live`, `failing`.
- Date format is strict ISO 8601 (`%aI`) for safe `new Date()` parsing.

## Quick Commands
- `./scripts/simplify.sh`
- `./scripts/monetize.sh . --write`
- `./scripts/audit.sh .`
- `./scripts/ship.sh .`
