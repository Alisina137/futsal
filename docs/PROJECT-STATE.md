# PROJECT STATE

## Product objective
Increase futsal venue utilization and revenue through reliable availability and mobile booking, with integrated venue operations, competitions, and a futsal-specific public presence.

## Product source
`docs/PRODUCT-SPEC.md` — LeagueKick Authoritative Product Specification v1.0.

## Implementation workflow
`docs/SOFTWARE-DEVELOPMENT-WORKFLOW-V4.md`.

## Current stack
- Monorepo: pnpm workspaces
- Mobile: Expo SDK 57, React Native 0.86, TypeScript, Expo Router
- API: Node.js, TypeScript, Express 5
- Database: PostgreSQL/Neon-compatible, Drizzle ORM
- Validation/contracts: Zod
- Auth: password + short-lived JWT access token + rotated opaque refresh session
- Localization: shared Dari/Pashto/English resources with RTL metadata

## Architecture decisions
- Structured monolith; no microservices.
- Mobile product is the primary customer interface.
- Runtime API connections use `DATABASE_URL` (Neon pooled recommended); Drizzle migrations prefer `DATABASE_DIRECT_URL`.
- Server owns roles, venue ownership, trial/subscription entitlement, availability authority, booking price, booking status, and cancellation authority.
- One Venue Owner account maps to at most one venue.
- Venue identity is locked after trial/subscription activation so one trial cannot be repurposed to another physical venue.
- Premium trial duration is exactly 72 hours from the server-issued start timestamp.
- Venue availability is derived from opening hours and active playing areas minus active bookings and owner blocks.
- Online and manual bookings share the same occupancy source and conflict path.
- Real PostgreSQL writes serialize per playing area using `pg_advisory_xact_lock(hashtext(area_id))`, then re-check overlap in the same transaction.
- PENDING and CONFIRMED bookings consume capacity; CANCELLED bookings do not.
- Booking idempotency is scoped to the actor plus client idempotency key.
- Confirmed booking price/currency and cancellation policy are snapshotted at creation.
- Cached availability is orientation-only. The client disables booking unless a live server response is available and the device is online.
- Afghanistan launch venue timezone defaults to `Asia/Kabul`; timestamps are persisted as UTC instants.

## Current implementation phase
Phase 3 — Availability, Schedule and Booking.

## Phase 1 status
Automated verification previously passed:
- workspace TypeScript checks,
- localization/contracts/auth tests,
- API build,
- Android Expo export,
- canonical Drizzle Phase 1 migration.

## Phase 2 status
Status: **Implemented; final local verification still pending.**

The canonical Phase 2 migration is committed:
- `0001_clean_retro_girl`.

Phase 2 delivered:
- one-owner-account → one-venue model,
- eight-step owner onboarding,
- playing areas and opening hours,
- explicit 72-hour Premium trial,
- duplicate physical-venue trial prevention,
- server-side trial expiry,
- owner dashboard,
- trilingual RTL owner UX.

## Phase 3 delivered
1. Booking/domain model:
   - booking mode, status and source,
   - venue blocks,
   - online/manual bookings,
   - actor-scoped idempotency,
   - persisted AFN confirmation price,
   - cancellation-policy snapshot.
2. Live availability:
   - public venue list/detail,
   - operating-hours slot generation,
   - active playing-area pricing,
   - bookings/blocks subtracted from inventory,
   - server freshness timestamp.
3. Atomic conflict protection:
   - transaction-scoped PostgreSQL advisory lock per playing area,
   - overlap revalidation after lock,
   - one winner for concurrent attempts,
   - same conflict path for online, manual and blocked occupancy.
4. Player booking:
   - venue discovery,
   - date availability,
   - live booking confirmation,
   - My Bookings,
   - player cancellation,
   - friendly slot-conflict recovery.
5. Offline resilience:
   - availability cache in AsyncStorage,
   - cached/stale labeling,
   - cached slots cannot confirm offline,
   - reconnect triggers fresh availability reload.
6. Owner operations:
   - daily schedule,
   - online/manual booking visibility,
   - manual phone/walk-in booking,
   - block/unblock time,
   - owner booking cancellation.
7. Subscription/suspension behavior:
   - only Trial/Active ACTIVE venues expose live public inventory,
   - expired/cancelled/suspended venues cannot accept new bookings,
   - owner schedule reads remain available for continuity.
8. Security/reliability:
   - player and owner role checks,
   - owner tenant isolation,
   - write rate limits,
   - real-date validation,
   - direct area→venue lookup,
   - retry-safe booking replay.
9. Localization:
   - player discovery/booking flow localized in Dari, Pashto and English,
   - owner schedule/manual/block flow localized in Dari, Pashto and English.
10. Verification coverage added:
   - exactly-one-winner booking race,
   - manual-vs-online conflict,
   - block removes inventory,
   - cancellation releases inventory,
   - expired trial hides inventory,
   - same-actor idempotent retry,
   - owner tenant isolation,
   - invalid date rejection,
   - static Phase 3 resilience verifier.

## Phase 3 verification status
Status: **Implemented; migration generation, local verification, and live smoke testing pending.**

Run on the user environment:
1. `pnpm db:generate`
   - expected next migration: `0002_*.sql`,
   - review and commit the generated migration and `drizzle/meta/0002_snapshot.json`.
2. `pnpm verify`
   - now begins with `pnpm verify:phase3`,
   - then workspace typecheck, tests, API build, Android Expo export.
3. `pnpm db:migrate` against `DATABASE_DIRECT_URL`.
4. Run API + mobile and complete `docs/PHASE-03-TEST-PLAN.md`.

Do not call Phase 3 fully verified until these steps pass.

## Known external requirements
- Neon pooled `DATABASE_URL` for API runtime.
- Neon direct `DATABASE_DIRECT_URL` for Drizzle migration work.
- Strong `ACCESS_TOKEN_SECRET`.
- Reachable `EXPO_PUBLIC_API_URL` for the physical Android device.

## Latest source baseline
Phase 3 implementation branch: `phase-03-availability-booking`.

Task PRs are merged into the phase branch. `main` remains untouched.

## Next phase
Phase 4 — Promotions, Feed and Notifications.

Phase 4 should not be marked complete until the Phase 3 migration and verification baseline are green.
