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
- Shared contracts/localization/design tokens are workspace packages.
- Server owns roles, authorization, password hashing, session state, and future subscription/booking authority.
- Phase 1 registration supports Player and Venue Owner identities only; owner venue/trial setup remains Phase 2.
- Temporary offline state preserves cached/local state and never pretends a server write succeeded.

## Current implementation phase
Phase 1 — Product Foundation and Localization.

## Phase 1 intended acceptance
- Dari/Pashto/English switch and persist.
- RTL primitives and navigation order are language-aware.
- Registration/login/session refresh/logout foundation works against configured PostgreSQL.
- Protected API route requires a valid access token.
- Network failures preserve existing local session/screen state and show non-blocking status feedback.
- Base users/roles/sessions/audit schema exists.

## Verification status
- Static repository checks completed: JSON manifests parse, required Phase 1 files are present, localization resources include Dari/Pashto/English, and a basic secret-marker scan is clean.
- TypeScript parser-only verification reported no syntax diagnostics.
- Full dependency installation, workspace typecheck, tests, Expo export, and API build are pending because the implementation environment cannot resolve the npm registry.
- Database migration and live mobile/API integration additionally require a configured `DATABASE_URL`, strong token secret, and reachable API environment.

## Known external requirements
- PostgreSQL/Neon `DATABASE_URL`.
- Strong `ACCESS_TOKEN_SECRET`.
- Reachable `EXPO_PUBLIC_API_URL` for a physical Expo Go device.

## Latest source baseline
GitHub repository `Alisina137/futsal` was empty before Phase 1. Phase 1 is delivered on branch `phase-01-foundation-localization`.

## Next phase
Phase 2 — Venue Owner Onboarding, Trial and Venue Model.
