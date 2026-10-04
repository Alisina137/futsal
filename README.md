# LeagueKick

LeagueKick is a mobile-first futsal venue booking, operations, competition, and community platform designed initially for Afghanistan.

## Current implementation state

Phase 2 — Venue Owner Onboarding, Trial and Venue Model.

Implemented so far:

- Expo SDK 57 + React Native mobile shell.
- Dari, Pashto, and English localization with RTL-aware layout primitives.
- Player and venue-owner registration/login/session foundation.
- PostgreSQL + Drizzle users, roles, sessions, audit, venue, playing-area, opening-hours, subscription, and trial-claim models.
- One Venue Owner account → one venue enforcement.
- Eight-step venue-owner onboarding.
- Explicit 72-hour Premium trial; account creation alone never starts it.
- Server-side trial expiry, duplicate physical-venue trial protection, and venue-identity locking after activation.
- Owner dashboard with setup and trial/subscription state.
- Offline/connectivity behavior that preserves local session/screen state through temporary network loss.

Venue discovery, live availability, and player booking are the next product milestone.

## Environment

Copy the examples:

```powershell
cd C:\projects\futsal
Copy-Item .env.example .env
Copy-Item apps\mobile\.env.example apps\mobile\.env.local
```

Use Neon's pooled URL for API runtime:

```env
DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
```

Use Neon's direct URL for Drizzle migrations:

```env
DATABASE_DIRECT_URL=postgresql://.../neondb?sslmode=require
```

Also configure a strong `ACCESS_TOKEN_SECRET` and set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local` to an address your phone can reach.

## Phase 2 apply and verify

After pulling the Phase 2 branch:

```powershell
cd C:\projects\futsal
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm verify
```

The first `pnpm db:generate` after pulling Phase 2 should create the `0001_*.sql` migration and `drizzle/meta/0001_snapshot.json`. Review and commit those generated files before continuing development.

Run development servers in separate terminals:

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
