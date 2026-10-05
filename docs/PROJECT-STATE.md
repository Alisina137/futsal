# PROJECT STATE

## Product objective
Increase futsal venue utilization and revenue through reliable availability and mobile booking, with integrated venue operations, competitions, and a futsal-specific public presence.

## Product source
`docs/PRODUCT-SPEC.md` — Futsal Authoritative Product Specification v1.0.

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

## Core architecture decisions
- Structured monolith; no microservices.
- Mobile is the primary customer interface.
- Authentication identity is separate from product roles: signup creates a role-free base user with required username + phone + password confirmation; roles are activated later.
- Usernames are unique, 3–12 characters, and use letters/numbers/underscore.
- Login accepts either normalized Afghanistan phone or normalized username with the same password and returns one generic invalid-credentials message.
- Full name is configured after signup; it is not a registration requirement.
- Password recovery is phone-based but verification-gated: 6-digit short-lived code → short-lived reset token → username/password update → refresh sessions revoked; existing access tokens remain bounded by the 15-minute access-token TTL.
- A successful phone/SMS credential reset starts a 72-hour cooldown; after verified phone ownership, attempts during the cooldown receive the exact next-allowed timestamp, and the final reset write enforces the same cooldown atomically.
- Recovery requests do not reveal phone/account existence before code verification; production requires an HTTPS SMS delivery provider while local development may expose the code only in explicit non-production dev mode.
- Self-service role activation is limited to PLAYER, VENUE_OWNER, TEAM_MANAGER and REFEREE; privileged staff/admin roles remain controlled.
- Profile is the single mobile surface for account identity and role selection/activation; Home does not expose username/phone/role controls.
- Account Profile supports optional full name, HTTPS profile image, age, email, city and short bio; these remain private account fields and do not automatically become public Player Profile data.
- Home remains discovery-oriented with venue discovery, Feed, and Competitions available to authenticated users; owner Home retains operational dashboard content plus these discovery entry points.
- API runtime uses `DATABASE_URL`; Drizzle migration work prefers `DATABASE_DIRECT_URL`.
- `pnpm db:migrate` now executes the runtime Drizzle migrator directly from the database package, normalizes Neon SSL modes to explicit `verify-full`, and prints the underlying PostgreSQL code/detail/hint instead of only a recursive pnpm failure.
- Server owns authorization, venue ownership, entitlement, live availability, confirmation price, promotion validity and notification fan-out.
- One Venue Owner account maps to at most one venue.
- Premium trial is exactly 72 hours and starts explicitly.
- Booking/manual booking/blocks share one occupancy source of truth.
- PostgreSQL booking/block writes serialize per playing area with a transaction-scoped advisory lock.
- Cached availability is read-only orientation data; live server confirmation is required for booking.
- Promotions reference exact live future inventory; they do not create separate capacity.
- Promotion discounted price is applied server-side to live availability and persisted at booking confirmation.
- Booking, blocking, expiry, suspension or entitlement loss invalidates active promotion inventory.
- Venue follows are public user→venue relationships and do not expose private venue/customer data.
- In-app notifications are persisted server-side and deduped by user + event key.
- Marketing notifications are limited to 3 per user per rolling 24 hours.
- Push foundation stores Expo push devices and PENDING delivery/outbox rows; no external push dispatch worker/provider is enabled yet.
- Player identity is separated from private auth/contact data; public player/team DTOs never expose phone/email.
- Players can belong to multiple teams; membership uniqueness is scoped to one user + one team.
- Team-manager authority is object-scoped to the team's current `managerUserId`; UI visibility is never an authorization boundary.
- Team invitations expire after 7 days, are single-use, and are deduplicated while pending per team/player.
- Venue-owner-only accounts cannot participate in player/team flows unless they also have the PLAYER role.
- Competition standings/brackets are derived from persisted match results, not editable totals.
- Scheduled/in-progress competition matches occupy the same venue-area calendar used by bookings and blocks.
- Competition scheduling and booking/block writes share the same playing-area advisory-lock conflict boundary.
- Group→Knockout qualification is derived from completed group standings; knockout progression is deterministic and snapshot-safe.
- Result corrections require a reason and apply downstream-impact safeguards.
- Afghanistan launch venue timezone defaults to `Asia/Kabul`; persisted timestamps are UTC instants.

## Current implementation phase
Pre-release verification and corrections after Phase 8 — Release Readiness.

All Phase 8 implementation tasks are integrated on `phase-08-release-readiness`: Android release configuration/assets, production security and observability hardening, mobile resilience/safe recovery, accessibility/localization review, support/backup/monitoring tooling, and the final release verification/test plan.

## Migration baseline
Committed canonical migrations:
- `0000_dear_mole_man` — Phase 1.
- `0001_clean_retro_girl` — Phase 2.
- `0002_careless_jack_power` — Phase 3.
- `0003_numerous_darwin` — Phase 4.
- `0004_past_goliath` — Phase 5.
- `0005_robust_smiling_tiger` — Phase 6 competition engine.
- `0006_phase7_commercial_core` — Phase 7 venue verification, subscription payments and platform configuration.
- `0007_password_reset_challenges` — pre-release secure phone verification/password reset challenges.
- `0008_account_profile_fields` — optional private account profile image URL, age, city and bio fields; email uses the existing normalized unique column.
- `0009_password_reset_cooldown` — authoritative last successful credential-reset timestamp for the 72-hour cooldown.

The user previously reported Phase 6 migration `0005_robust_smiling_tiger.sql` applied successfully. The user also reported Phase 7 migration `0006_phase7_commercial_core.sql` applied successfully. Phase 8 itself had no database schema change. Pre-release authentication corrections add `0007_password_reset_challenges.sql`; it is committed but must not be marked applied until the user runs `pnpm db:migrate` successfully.

## Phase 1 status
Foundation implemented and previously verified.

## Phase 2 status
Implemented. Canonical migration is committed. Final end-to-end device verification was not separately re-confirmed after later stacked phases.

## Phase 3 status
Implemented with canonical `0002_careless_jack_power` migration committed.

Phase 3 includes:
- live public venue availability,
- online/manual booking,
- owner blocks,
- cancellation,
- owner schedule,
- atomic playing-area conflict protection,
- actor-scoped idempotency,
- offline cached availability that cannot book,
- player/owner booking UI,
- Phase 3 resilience verifier and test plan.

Latest reported verification before Phase 4:
- Phase 3 resilience verifier passed.
- API TypeScript passed after route-param fixes.
- remaining mobile tab typing issue was fixed and pushed.
- a final full `pnpm verify` result after that last fix has not yet been supplied.

Do not retroactively label Phase 3 fully verified until the full command is confirmed green.

## Phase 4 delivered

### Promotions
- Owner selects a real current future slot from live availability.
- Discount price must be lower than the current server slot price.
- Active promotion is unique per exact slot; a closed promotion does not permanently reserve that slot identity.
- Live availability exposes discounted price, original price and promotion ID.
- Online booking persists the discounted server price.
- Booking/blocking closes overlapping promotions inside the real database occupancy transaction.
- Read-time refresh closes expired, suspended or no-longer-entitled promotions.
- Owner can manually close active promotions.
- Public Feed contains only effective ACTIVE promotions.

### Venue posts
- Owner immediate publish/unpublish.
- Text + optional HTTPS image URL.
- Structured CTA: none, venue or active promotion.
- Competition CTA was deferred in Phase 4 and is now enabled by the Phase 6 public competition routes.
- Re-publishing rejects stale promotion CTA.
- Public feed/post reads exclude suspended venue content.

### Follow and Feed
- Authenticated users can follow/unfollow active venues idempotently.
- Public Feed combines promotions and posts.
- Following Feed scopes content to followed venues.
- Player venue page shows follow state and follower count.
- Promotion/post cards deep-link through typed Futsal destinations.

### Notifications
- Persisted in-app notification history.
- Booking confirmed/cancelled notifications.
- Follower promotion and venue-post notifications.
- User preferences for in-app, push, promotions and venue posts.
- User + event dedupe.
- Marketing frequency cap: 3 alerts per rolling 24 hours.
- Expo push device registration model.
- Push delivery/outbox rows for later provider dispatch.
- Mobile notification center, read state and preferences.

### Mobile UX
- Player Feed tab.
- All/Following filter.
- Discounted/original AFN display.
- Promotion-aware venue availability.
- Venue follow/unfollow.
- Venue post detail + CTA.
- Notification center and preferences.
- Owner dashboard marketing entry points.
- Owner Promotions list/create/close.
- Owner Posts list/create/publish/unpublish.
- Dari/Pashto/English localization with RTL support.

### Verification coverage
- Phase 4 contract validation.
- Promotion API tests.
- Follow idempotency test.
- Post publish/unpublish test.
- Notification dedupe test.
- 3-per-24-hour marketing frequency test.
- Booking→notification integration test.
- Promoted-slot booking-price regression.
- `verify:phase4` static invariant gate.
- `docs/PHASE-04-TEST-PLAN.md`.

## Phase 4 verification status
Status: **Implemented with canonical `0003_numerous_darwin` migration committed.** Later stacked-phase verification continues to exercise the Phase 4 invariant gate; a separate final live-device-only Phase 4 retest was not recorded.

## Known runtime requirement
For a physical Android phone:
- Expo Metro tunnel/LAN reachability and API reachability are separate.
- `EXPO_PUBLIC_API_URL` must point to an API URL the phone can actually open.
- If LAN access to port 4000 fails, run `ngrok http 4000` and use that HTTPS URL in `apps/mobile/.env.local`, then restart Expo with `--clear`.

## Phase 5 delivered

### Player identity
- Persistent `player_profiles` separated from private authentication/contact data.
- Editable public display name, image URL metadata, futsal position and PUBLIC/PRIVATE visibility.
- Public player API returns approved profile fields and public team relationships only.
- Private player profiles are unavailable through public player endpoints.
- Venue-owner-only accounts are rejected from player/team participation.

### Teams and roster
- Persistent teams with name, city, logo URL metadata, PUBLIC/PRIVATE privacy and ACTIVE/ARCHIVED status foundation.
- Creator becomes the initial manager and active roster member atomically.
- A player can belong to multiple teams simultaneously.
- One membership row per user/team prevents duplicate roster entries.
- Public teams expose approved roster identity only; private teams hide roster from non-members.
- Active members can view the private roster.

### Manager/captain authority
- Team authority is object-scoped to the current manager.
- Manager can update team identity/privacy.
- Manager can edit shirt numbers, assign/remove captain, remove members and transfer management.
- Captain must be an active member of the same team.
- Manager transfer requires an active member and immediately revokes the old manager's manager authority.
- Manager cannot remove themselves before transferring management.

### Invitations
- Manager invites an existing PLAYER by username or Afghanistan phone number.
- Pending invitation uniqueness per team/player.
- 7-day expiry.
- Accept/decline/revoke lifecycle.
- Acceptance atomically creates/reactivates membership.
- Captain invitation atomically updates captain state.
- Team invitation notifications have a separate preference, user/event dedupe and Team Invitations deep-link.
- Notification delivery failure does not invalidate the authoritative invitation.

### Mobile UX
- Profile → My Teams entry.
- Profile → Player Profile entry.
- Create team.
- My Teams list.
- Public/member team detail.
- Public player profile.
- Editable player identity/privacy.
- Team Invitations inbox.
- Manager team-settings/roster workspace.
- Invite, revoke, shirt number, captain, member removal and manager-transfer flows.
- Dari/Pashto/English localization and RTL-aware action order.

### Verification coverage
- Multi-team membership regression.
- Public private-contact leakage regression.
- Private team roster boundary.
- Private player-profile boundary.
- Non-manager mutation rejection.
- Captain/manager must be active members.
- Invitation duplicate/accept/decline/expiry/revoke.
- Team-invite notification preference.
- Old-manager authority revocation after transfer.
- Venue-owner-only player/team rejection.
- `verify:phase5` invariant gate.
- `docs/PHASE-05-TEST-PLAN.md`.

## Phase 5 verification status
Status: **Implemented with canonical `0004_past_goliath` migration committed.** The Phase 5 invariant gate passes in the user's Phase 6 verification run; a separate complete live Android Phase 5 test-plan signoff was not recorded before Phase 6 began.

## Phase 6 delivered

### Competition domain and formats
- Persistent competitions scoped to one venue.
- Formats: LEAGUE, KNOCKOUT and GROUP_KNOCKOUT.
- Draft/public lifecycle with registration open/close, scheduled/in-progress, completed, archived and cancelled states.
- Team registration/application/invitation records with seed/group metadata.
- Competition groups, matches and player-match statistics.
- Premium entitlement and venue tenancy enforced for owner competition writes.

### Registration
- Team managers can apply their own active teams.
- Venue owners can invite active teams.
- Team-manager response remains object-scoped.
- Server-authoritative accepted-team capacity.
- Registration mutation closes once competition execution begins.

### League engine
- Deterministic round-robin generation for odd/even team counts.
- Server-configurable win/draw/loss points.
- Standings recomputed from completed/corrected results.
- Tie-break support: points, goal difference, goals for, head-to-head and admin seed.
- Completion blocked until required fixtures have results.

### Knockout engine
- Seeded bracket generation.
- Balanced non-power-of-two bye distribution with no fake playable bye fixtures.
- Winner progression through stored next-match links.
- Knockout draws rejected.
- Downstream correction safeguards.
- Final winner exposed as champion.

### Group → Knockout
- Deterministic group assignment.
- Per-group round-robin fixtures.
- Per-group derived standings.
- Qualification only after all group matches complete.
- Knockout snapshot generated from configured qualifiers per group.
- Completion blocked until knockout exists and finishes.
- Group-result correction can rebuild the bracket only while safe.

### Venue-calendar occupancy
- Scheduled/in-progress competition matches are first-class occupancy.
- Public availability subtracts competition matches.
- Booking/manual booking/block writes treat competition matches as conflicts.
- Competition scheduling acquires the same per-area PostgreSQL advisory lock and checks active bookings, blocks and other competition matches.

### Results and stats
- Result entry for scheduled/in-progress matches.
- Corrections require reason and are written to audit logs.
- Player-match stats are validated against active roster/team participation.
- Public player-stat aggregation.

### Public/mobile UX
- Public competition discovery.
- Competition hub with fixtures/results.
- League/group standings.
- Knockout bracket.
- Accepted teams.
- Player stats.
- Team-manager registration.
- Competition post CTA deep links.
- Owner competition list/create/manager.
- Registration decisions/invites.
- Fixture generation, scheduling, result entry/correction, knockout generation, completion/archive.
- Home/Profile/Owner Dashboard competition entry points.
- Dari/Pashto/English localization and RTL-aware layouts.

### Verification coverage
- Pure engine tests for round robin, standings, groups, qualification and byes.
- Setup/registration/Premium/capacity tests.
- Full league lifecycle regression.
- Knockout progression/draw/correction tests.
- Group→Knockout qualification/completion regression.
- Five-team bye regression.
- `verify:phase6` invariant gate.
- `docs/PHASE-06-TEST-PLAN.md`.

## Phase 6 verification status
Status: **Implemented; full local verification and live Android competition testing pending.**

The user already generated and applied:

```text
packages/database/drizzle/0005_robust_smiling_tiger.sql
packages/database/drizzle/meta/0005_snapshot.json
packages/database/drizzle/meta/_journal.json
```

The database migration application succeeded. Do not regenerate the migration unless the database schema changes again.

The Phase 6 migration is committed in the current stacked baseline. The remaining Phase 6 caveat is live Android competition/calendar-conflict signoff; current automated verification is exercised again by the integrated Phase 7 gate.

Do not mark Phase 6 live-device verification complete until the competition/calendar conflict journeys pass.

## Phase 7 delivered

### Subscription lifecycle and continuity
- One shared server-side entitlement evaluator is used across booking, marketing and competitions.
- Expired trials and ended paid periods resolve to `EXPIRED` / `CONTINUITY`.
- New public bookable inventory and Premium writes are blocked after expiry.
- Owners retain schedule access and existing-booking servicing/cancellation.
- Owner billing status exposes FULL / CONTINUITY / NONE access modes.
- Owner can request reactivation without client-side entitlement activation.

### Billing and commercial configuration
- Manual/admin subscription activation with configurable month periods.
- Durable payment history with amount, period, provider, optional provider reference, note and reconciliation state.
- Duplicate non-empty provider references are rejected.
- Payment records can be voided with an audited reason without rewriting historical entitlement.
- Monthly/annual price and trial-duration platform configuration.
- Feature flags and notification-template configuration are persisted.
- Future owner trials use configured trial duration; default remains 72 hours.
- Owner Subscription mobile screen shows entitlement, verification, prices and payment history.

### Owner analytics
- Date-range analytics API and mobile screen.
- Booking totals, confirmed/cancelled counts, online/manual mix and online-booking share.
- Non-cancelled booking GMV estimate.
- Booked minutes, available venue minutes and occupancy rate derived from authoritative bookings, active areas and opening hours.
- Empty-state behavior avoids meaningless zero dashboards.
- Analytics remain read-only and available during continuity mode.

### Platform admin
- `PLATFORM_ADMIN`-protected admin API and mobile console.
- User search, suspension/restoration and refresh-session revocation.
- Venue search, verification/rejection, suspension/restoration.
- Duplicate venue review groups.
- Trial extension.
- Manual subscription activation and payment reconciliation.
- Configurable commercial settings.
- Support-note audit records.
- Venue-post unpublish and promotion-close moderation controls.
- Operational dashboard for active users/venues, verification queue, trial/paid/expired venues, recorded subscription payments and booking GMV estimate.
- Privileged actions write audit-log records with actor, target and reason/metadata.
- Self-suspension of the current admin account is blocked.

### Data and migration
- Venue verification status and verifier identity/timestamp.
- `subscription_payments`.
- `platform_settings`.
- Canonical `0006_phase7_commercial_core` migration, snapshot and journal entry.

### Mobile/localization
- Owner Subscription entry.
- Owner Analytics entry.
- Platform Admin entry for admin-role accounts.
- Dari, Pashto and English translations with RTL-aware layouts.

### Verification coverage
- Subscription entitlement unit tests.
- Continuity-mode booking regression.
- Phase 7 commercial API/service tests for owner billing, analytics, admin authorization and activation.
- `verify:phase7` invariant gate.
- `docs/PHASE-07-TEST-PLAN.md`.

## Phase 7 verification status

Status: **Implemented; migration applied and automated verification reported without remaining errors by the user. Live mobile/admin test-plan signoff remains a separate manual requirement.**

Phase 6 live-device competition verification caveat remains unchanged.

## Phase 8 delivered

### Android release packaging
- App version advanced to 1.0.0 while preserving package `com.leaguekick.app` and the existing deep-link scheme.
- Preview/internal APK and production AAB EAS profiles.
- App icon, adaptive icon and Play feature graphic committed.
- Play listing draft and real-screenshot capture plan.
- Preview/production mobile API URL guidance requires HTTPS outside local development.

### Security, health and observability
- Production configuration rejects wildcard CORS, non-HTTPS browser origins and weak/placeholder access-token secrets.
- Neon examples use explicit `sslmode=verify-full`.
- Request correlation IDs are returned in headers/API errors.
- Structured request logs contain method, normalized path, status and duration without request bodies or credentials.
- API responses are no-store.
- Separate liveness `/health` and database readiness `/ready`.
- Graceful shutdown and bounded server request/header timeouts.
- Release-readiness API tests cover health, readiness secrecy, CORS, request IDs and production configuration.

### Mobile resilience and support
- Existing 12-second network timeout retained.
- Read-only GET/HEAD requests may retry once for transient network/502/503/504 failures.
- Writes are never automatically replayed by the generic client.
- Timeouts remain non-destructive to stored authenticated sessions.
- Localized crash boundary never renders raw exception/stack text.
- Support & diagnostics screen exposes safe app/API/connectivity/request correlation details only.

### Accessibility and localization
- Touch target remains 50dp.
- Buttons/language selectors/settings actions have accessibility labels/hints.
- Form hints/errors and connectivity changes are announced.
- Dynamic text scaling remains enabled.
- Support/recovery strings added in Dari, Pashto and English.

### Operations and privacy
- Guarded PowerShell PostgreSQL backup and isolated restore commands.
- Backups are ignored by Git.
- Pilot operations/monitoring/incident/rollback runbook.
- Implementation-aligned pilot privacy notice.
- Phase 8 test plan covers all 15 critical E2E journeys, low-connectivity, accessibility/device matrix, security, monitoring and restore drill.

### Verification coverage
- `verify:phase8` static invariant gate.
- `release:check` integrated repository gate.
- Clean-install GitHub Release Readiness workflow.
- `docs/PHASE-08-TEST-PLAN.md`.

## Phase 8 verification status

Status: **Implemented; clean GitHub CI completed the full `pnpm verify` gate successfully on the Phase 8 integration branch. Live pilot signoff is still required before describing the product as pilot-ready.**

Pilot signoff still requires a real preview APK/device run of the critical E2E matrix, Dari/Pashto TalkBack/large-text checks, deployed health/readiness/log correlation, an isolated backup/restore drill, real store screenshots, and operator-owned support/privacy/Play Console configuration.

## Next phase
Pilot release / launch signoff after the Phase 8 live-device and operations checklist passes.
