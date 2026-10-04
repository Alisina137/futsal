# Futsal

Futsal is a mobile-first futsal venue booking, operations, competition, and community platform designed initially for Afghanistan.

## Current implementation state

Phase 6 — Competition Engine.

Implemented through Phase 6:

- Dari, Pashto and English mobile experience with RTL-aware layouts.
- Player and Venue Owner auth/session foundation.
- One owner account → one venue enforcement.
- Explicit 72-hour Premium trial.
- Venue/playing-area/opening-hours model.
- Public live availability.
- Atomic online/manual booking and owner blocks.
- Player My Bookings and owner Schedule.
- Exact-slot discounted promotions tied to real inventory.
- Server-authoritative promotional booking price.
- Automatic promotion close on booking/block/expiry/entitlement loss.
- Venue posts with structured CTA.
- Venue follow/unfollow.
- Public and Following feeds.
- Persisted in-app notifications and preferences.
- Booking lifecycle and follower marketing notifications.
- Notification dedupe and marketing frequency limits.
- Expo push device/outbox foundation.
- Persistent player profiles with public/private visibility.
- Persistent teams and multi-team player membership.
- Object-scoped team manager/captain authority.
- Invite/accept/decline/revoke lifecycle with 7-day expiry.
- Team-invitation notification preference and dedupe.
- Public/private team roster boundaries.
- My Teams, Player Profile, invitation inbox, and manager roster workspace.
- League, Knockout and Group → Knockout competition formats.
- Team applications/invitations and accepted-team capacity enforcement.
- Deterministic fixtures, standings, qualification and knockout progression.
- Competition matches integrated into the venue booking/block occupancy calendar.
- Match results, correction audit trail and basic player statistics.
- Public competition discovery/detail/standings/bracket/teams/stats.
- Mobile venue-owner competition creation and operations.

Actual external push dispatch is not enabled yet; the provider-neutral persistence/outbox foundation remains in place. Advanced live scoring and matchmaking are intentionally excluded from Phase 6.

## Environment

Root `.env`:

```env
DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
DATABASE_DIRECT_URL=postgresql://.../neondb?sslmode=require

API_PORT=4000
CORS_ORIGIN=*
ACCESS_TOKEN_SECRET=<long-random-secret>
ACCESS_TOKEN_ISSUER=leaguekick-api
ACCESS_TOKEN_AUDIENCE=leaguekick-mobile
```

Mobile `apps/mobile/.env.local`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_PC_IPV4:4000
```

Never use `localhost` for a physical Android phone.

## Pull Phase 6

```powershell
cd C:\projects\futsal

git fetch origin
git checkout phase-06-competition-engine
git pull origin phase-06-competition-engine

pnpm install
```

## Verify the Phase 6 migration and implementation

Committed migration baseline:

- `0000_dear_mole_man`
- `0001_clean_retro_girl`
- `0002_careless_jack_power`
- `0003_numerous_darwin`
- `0004_past_goliath`

The user already generated:

```text
packages/database/drizzle/0005_robust_smiling_tiger.sql
packages/database/drizzle/meta/0005_snapshot.json
packages/database/drizzle/meta/_journal.json
```

and reported that `pnpm db:migrate` applied it successfully.

Do **not** run `pnpm db:generate` again unless the Phase 6 database schema changes.

Run:

```powershell
pnpm verify
```

`pnpm verify` now runs the Phase 6 competition invariant gate, earlier phase gates, workspace TypeScript checks, automated tests, and builds.

After verification is green, commit only the generated Phase 6 migration files:

```powershell
git add packages/database/drizzle/0005_robust_smiling_tiger.sql
git add packages/database/drizzle/meta/0005_snapshot.json
git add packages/database/drizzle/meta/_journal.json

git commit -m "chore: generate Phase 6 database migration"
git push origin phase-06-competition-engine
```

## Run the API

```powershell
cd C:\projects\futsal
pnpm dev:api
```

The API must listen on `0.0.0.0:4000`.

Test locally:

```powershell
Invoke-RestMethod http://localhost:4000/health
```

## Run Expo on a physical Android phone

Preferred when laptop and phone are on the same reachable Wi-Fi:

```powershell
cd C:\projects\futsal
pnpm --filter @leaguekick/mobile exec expo start --lan --clear --go
```

Before testing login/signup, open this in the phone browser:

```text
http://YOUR_PC_IPV4:4000/health
```

It must return the Futsal API health JSON. If it does not, mobile auth requests cannot work even if the Expo QR code opens successfully.

If the phone cannot reach your PC's port 4000, expose the API separately:

```powershell
ngrok http 4000
```

Then set the returned HTTPS URL in:

```text
apps/mobile/.env.local
```

Example:

```env
EXPO_PUBLIC_API_URL=https://example.ngrok-free.app
```

Restart Expo with `--clear` after changing the environment URL.

> Expo/Metro tunneling and Futsal API reachability are separate connections. A working Expo tunnel does not automatically expose port 4000.

## Signup troubleshooting

If mobile signup shows a generic request failure:

1. Keep `pnpm dev:api` running.
2. Confirm the phone can open `EXPO_PUBLIC_API_URL/health`.
3. Tap Sign Up again.
4. Read the API terminal output at the same moment.
5. If `/health` works but signup fails, the server log identifies the database/validation error.
6. If `/health` does not work, fix API reachability or use `ngrok http 4000`.

## Phase 6 live testing

Use:

```text
docs/PHASE-06-TEST-PLAN.md
```

Critical acceptance paths:

- deterministic league standings;
- correct seeded knockout progression and 5-team bye handling;
- Group → Knockout qualification and completion guards;
- competition match vs booking/block conflict in both directions;
- result correction reason/audit/downstream-impact safeguards;
- public competition discovery, fixtures/results, standings, bracket, teams and stats;
- owner create/register/schedule/result/complete workflows;
- Dari/Pashto/English and RTL/LTR competition UX.

Next phase after Phase 6 verification: Phase 7 — Subscription Enforcement, Analytics and Admin.

## Source of truth

- `docs/PRODUCT-SPEC.md` — product behavior/scope.
- `docs/SOFTWARE-DEVELOPMENT-WORKFLOW-V4.md` — implementation process.
- `docs/PROJECT-STATE.md` — current implementation state.
- Repository source/schema/configuration — current implementation authority.
