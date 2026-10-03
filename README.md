# LeagueKick

LeagueKick is a mobile-first futsal venue booking, operations, competition, and community platform designed initially for Afghanistan.

## Current implementation state

Phase 1 — Product Foundation and Localization.

Included in this phase:

- Expo SDK 57 + React Native mobile shell.
- Dari, Pashto, and English localization with RTL-aware layout primitives.
- Player and venue-owner registration/login foundation.
- Secure mobile token storage and refresh flow.
- Express API with server-side validation, rate limiting, RBAC-ready access tokens, and protected `/users/me`.
- PostgreSQL + Drizzle base schema for users, roles, sessions, and audit logs.
- Offline/connectivity banner that preserves local session and screen state through temporary network loss.
- Shared contracts, localization resources, and design tokens.

Venue creation, subscription trial behavior, availability, and booking begin in later specification phases.

## Local setup

```powershell
cd C:\projectsutsal
Copy-Item .env.example .env
Copy-Item apps\mobile\.env.example apps\mobile\.env.local
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm verify
```

Edit `.env` with your PostgreSQL/Neon credentials and a strong `ACCESS_TOKEN_SECRET`. In `apps/mobile/.env.local`, keep only `EXPO_PUBLIC_API_URL=...` and point it at the API address reachable from your phone.

Run development servers in separate PowerShell terminals:

```powershell
pnpm dev:api
```

```powershell
pnpm dev:mobile
```

For a physical Android phone using Expo Go, `EXPO_PUBLIC_API_URL` must not use `localhost`; use the PC LAN IP or a secure tunnel.

## Source of truth

- `docs/PRODUCT-SPEC.md` — what the product must do.
- `docs/SOFTWARE-DEVELOPMENT-WORKFLOW-V4.md` — how implementation proceeds.
- `docs/PROJECT-STATE.md` — current implementation state.
- Actual repository source/schema/configuration — current implementation authority.
