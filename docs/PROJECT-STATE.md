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
- Server owns roles, owner authorization, venue ownership, trial state, and subscription entitlement.
- One Venue Owner account maps to at most one venue by database constraint and server workflow.
- Venue identity is locked after trial/subscription activation so an account cannot repurpose one trial for another physical venue.
- Physical trial eligibility is keyed from normalized venue name + province + city + address and enforced with a unique server-side claim.
- Trial duration is exactly 72 hours from the server-issued start timestamp.
- Temporary network failure preserves cached/local session and language state and never grants server-owned entitlement.

## Current implementation phase
Phase 2 — Venue Owner Onboarding, Trial and Venue Model.

## Phase 2 delivered
1. Venue/domain schema: venues, playing areas, seven-day opening hours, subscriptions, and physical-venue trial claims.
2. Shared Zod contracts for owner onboarding and subscription state.
3. Owner-only API routes for onboarding status, save/update, preview, and explicit trial activation.
4. Database and server enforcement for one owner account → one venue.
5. Exact 72-hour Premium trial with server-side expiry and idempotent start behavior.
6. Duplicate physical-venue trial prevention and post-trial venue-identity locking.
7. Eight-step Android-first owner onboarding flow: account → identity/contact → location → playing area → hours → duration/price → preview/save → start trial.
8. Venue-owner dashboard with setup/subscription/trial states.
9. Dari, Pashto, and English localization for the complete Phase 2 experience.
10. Focused contract, localization, and API tests added for Phase 2 rules.

## Verification status
### Previously verified Phase 1
- Workspace TypeScript checks passed.
- Phase 1 localization/contracts/auth tests passed.
- API build passed.
- Android Expo export passed.
- Canonical Drizzle Phase 1 migration was generated and committed.

### Phase 2
Status: **Implemented; local verification and migration generation pending.**

Run on the user environment:
- `pnpm db:generate` to generate the Phase 2 migration from the updated Drizzle schema.
- Review and commit the generated `0001_*.sql` and `drizzle/meta/0001_snapshot.json`.
- `pnpm db:migrate` against Neon direct connection.
- `pnpm verify`.
- Live smoke test: owner registration → eight-step setup → save → explicit trial start → dashboard trial state → reload/session persistence.

## Known external requirements
- Neon pooled `DATABASE_URL` for API runtime.
- Neon direct `DATABASE_DIRECT_URL` for migrations.
- Strong `ACCESS_TOKEN_SECRET`.
- Reachable `EXPO_PUBLIC_API_URL` for the physical Android device.

## Latest source baseline
Phase 2 implementation is on branch `phase-02-venue-owner-onboarding`. Task PRs are merged into that branch; `main` remains untouched.

## Next phase
Phase 3 — Venue Availability and Player Booking Foundation.

Do not mark Phase 2 fully verified until the generated migration, `pnpm verify`, and live owner onboarding/trial smoke test pass on the configured Neon + Expo environment.
