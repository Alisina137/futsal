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
- pnpm dependency build scripts are explicitly allowlisted only for required packages (`argon2`, `esbuild`).
- TypeScript 6 path mapping avoids deprecated `baseUrl`.

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
### Passed on user environment — 2026-10-03
- `pnpm install` succeeded with pnpm 12.5.1.
- Workspace TypeScript verification passed for config, contracts, database, design tokens, localization, mobile, and API.
- Localization tests passed: 3/3.
- Shared contract tests passed: 2/2.
- API authentication tests passed: 3/3.
- API production build passed with tsup.
- Android Expo export passed.

### Still requires environment integration
- Apply the Phase 1 Drizzle migration to the configured PostgreSQL/Neon database.
- Start the real API with a strong `ACCESS_TOKEN_SECRET`.
- Run the mobile application against the reachable API URL.
- Smoke-test real registration, login, refresh, protected-route access, logout, language persistence, and offline/reconnect behavior on device.

## Known external requirements
- PostgreSQL/Neon `DATABASE_URL`.
- Strong `ACCESS_TOKEN_SECRET`.
- Reachable `EXPO_PUBLIC_API_URL` for a physical Expo Go device.

## Latest source baseline
Phase 1 is implemented on branch `phase-01-foundation-localization`. Automated typecheck/test/build verification passes on the user's Windows environment.

## Next phase
Phase 2 — Venue Owner Onboarding, Trial and Venue Model.

Do not begin Phase 2 until Phase 1 database migration and live API/mobile smoke verification are complete.
