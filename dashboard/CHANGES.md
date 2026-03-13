# Changelog

## 0.1.0 — 2026-02-20

### feat: integrate mission statement and mission control into single view

- Removed view toggle (mission / projects switch)
- Mission statement moved to header subtitle beneath h1
- Pillars grid and project grid now always visible on one unified scrollable page
- Stripped `mission-header` wrapper, title, and statement from `MissionControl`
- Removed `.view-toggle`, `.mission-header`, `.mission-title`, `.mission-statement` CSS blocks
- Added `.header-left` + `.mission-statement-header` styles
- Fixed `.header-top` `align-items: flex-start` so subtitle stacks under title correctly

## 0.0.0 — 2026-02-19

### init: developer dashboard with tally design system

- React + Vite SPA, dark editorial design (BC gov blue palette)
- Git repo scanning via `server/collect.js`, cached 60s
- Stats row, filter system (all / today / live / failing), staggered card animations

### feat: mission control view + mission statement

- Added `MissionControl` component with 5 pillars (Systems, Intelligence, Markets, Product, Automation)
- Per-pillar health badge, project count, active-today count, project tag links

### fix: NaNd ago bug, gradient cleanup, stale file removal
