# LeagueKick

LeagueKick is a mobile-first futsal venue booking, operations, competition, and community platform designed initially for Afghanistan.

## Current implementation state

Phase 3 — Availability, Schedule and Booking.

Implemented through Phase 3:

- Expo SDK 57 + React Native mobile application.
- Dari, Pashto, and English localization with RTL-aware layouts.
- Player and venue-owner authentication/session foundation.
- One owner account → one venue enforcement.
- Eight-step venue-owner onboarding and explicit 72-hour Premium trial.
- PostgreSQL/Drizzle venue, playing-area, opening-hours, subscription, booking, and block models.
- Public venue discovery and live availability.
- Server-authoritative online booking.
- Manual phone/walk-in booking.
- Owner block/unblock workflow.
- Shared owner schedule for online/manual bookings and blocked time.
- Player My Bookings + cancellation.
- PostgreSQL transaction-scoped advisory locking for booking conflict protection.
- Actor-scoped booking idempotency.
- Cached availability fallback that is visibly stale and never bookable offline.
- Trial/subscription gating for new inventory and bookings.

Promotions, Feed, and Notifications begin in Phase 4.

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

Use Neon's direct URL for Drizzle migration work:

```env
DATABASE_DIRECT_URL=postgresql://.../neondb?sslmode=require
```

Also configure:

```env
API_PORT=4000
CORS_ORIGIN=*
ACCESS_TOKEN_SECRET=<long-random-secret>
ACCESS_TOKEN_ISSUER=leaguekick-api
ACCESS_TOKEN_AUDIENCE=leaguekick-mobile
```

In `apps/mobile/.env.local`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_PC_LAN_IP:4000
```

For a physical Android phone, do not use `localhost`.

## Apply and verify Phase 3

Pull the Phase 3 branch:

```powershell
cd C:\projects\futsal
git fetch origin
git checkout -B phase-03-availability-booking origin/phase-03-availability-booking
pnpm install
```

Generate the Phase 3 migration:

```powershell
pnpm db:generate
```

Phase 1 and Phase 2 already use `0000` and `0001`, so Phase 3 should generate a new `0002_*.sql` plus `drizzle/meta/0002_snapshot.json`.

Review the generated migration, then run:

```powershell
pnpm verify
pnpm db:migrate
```

`pnpm verify` includes the Phase 3 resilience invariant check, workspace typechecks, automated tests, API build, and Android Expo export.

After successful migration/verification, commit the generated Drizzle files:

```powershell
git add packages/database/drizzle
git commit -m "chore: generate Phase 3 database migration"
git push origin phase-03-availability-booking
```

## Run development servers

Terminal 1:

```powershell
cd C:\projects\futsal
pnpm dev:api
```

Terminal 2:

```powershell
cd C:\projects\futsal
pnpm dev:mobile
```

Use `docs/PHASE-03-TEST-PLAN.md` for the Phase 3 live smoke test.

## Source of truth

- `docs/PRODUCT-SPEC.md` — what the product must do.
- `docs/SOFTWARE-DEVELOPMENT-WORKFLOW-V4.md` — how implementation proceeds.
- `docs/PROJECT-STATE.md` — current implementation state.
- Actual repository source/schema/configuration — current implementation authority.
