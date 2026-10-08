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
- Admin web development entry: `pnpm dev:admin` launches a dedicated desktop management console on port 8082 with admin-specific login, a browser-local persisted admin session, admin-safe `/login`↔`/admin` routing, sidebar navigation, dashboard metrics, user/venue/subscription/configuration/support/moderation/audit areas, while reusing the same API, localization, and server-side `PLATFORM_ADMIN` authorization rules.
- API: Node.js, TypeScript, Express 5
- Database: PostgreSQL/Neon-compatible, Drizzle ORM
- Validation/contracts: Zod
- Auth: password + short-lived JWT access token + rotated opaque refresh session
- Localization: shared Dari/Pashto/English resources with RTL metadata

## Core architecture decisions
- Structured monolith; no microservices.
- Mobile is the primary customer interface.
- Primary mobile navigation uses the shared header: hamburger drawer fixed at top-left, profile image/avatar fixed at top-right, and the previous bottom tab bar is hidden. Shared order is Home → Dashboard (only for Player, Venue Owner, Team Owner, Referee, Platform Admin) → Venues → Teams → Competitions → My Reserves → Profile. Normal User omits Dashboard. Home is the shared social feed for every role; role-specific operations live under `/dashboard`.
- Authentication identity is separate from product roles: signup creates a role-free base user with required username + phone + password confirmation; roles are activated later.
- Usernames are unique, 3–12 characters, and use letters/numbers/underscore.
- Login accepts either normalized Afghanistan phone or normalized username with the same password and returns one generic invalid-credentials message.
- Full name is configured after signup; it is not a registration requirement.
- Password recovery is phone-based but verification-gated: 6-digit short-lived code → short-lived reset token → username/password update → refresh sessions revoked; existing access tokens remain bounded by the 15-minute access-token TTL.
- A successful phone/SMS credential reset starts a 72-hour cooldown; after verified phone ownership, attempts during the cooldown receive the exact next-allowed timestamp, and the final reset write enforces the same cooldown atomically.
- Recovery requests do not reveal phone/account existence before code verification; production requires an HTTPS SMS delivery provider while local development may expose the code only in explicit non-production dev mode.
- Normal authenticated accounts can discover and reserve venues without buying a role. The only self-service paid management subscriptions are Venue Owner (1000 AFN/month) and Team Owner / `TEAM_MANAGER` (300 AFN/month); payment confirmation gates role activation.
- Profile is the single mobile surface for account identity and the two paid management subscriptions. Venue referees are scoped to one venue, while team players are scoped through team membership rather than global paid account roles.
- Account Profile supports optional full name, HTTPS profile image, age, email, city and short bio; these remain private account fields and do not automatically become public Player Profile data.
- Home is the shared personalized social feed for all account types: it shows posts from followed Venues, Teams, and Competitions and supports author/profile navigation, post Like, dedicated Facebook-style Comments, and native Share. Comments support add, edit/delete own comment, and like/unlike comments. Role-specific operational content is accessed from Dashboard instead of replacing Home.
- Normal User Teams is a directory of all ACTIVE teams, not a "My Teams" workspace. Users can open any team profile and send one pending join request; membership/Player access is granted only after the Team Owner accepts.
- Six role-demo accounts are standardized by `pnpm db:seed:roles`: `shams` Normal User, `abdul` Player, `mahdi` Venue Owner, `alisina` Team Owner, `Saeed` Referee, and `ali` Platform Admin. The seeder requires those login accounts to already exist and never changes passwords.
- Normal User `Teams` page is an all-active-team directory, not “My Teams”. Each team can be opened for its public/profile information; non-members can send a join request and see a pending state until the Team Owner responds.
- API runtime uses `DATABASE_URL`; Drizzle migration work prefers `DATABASE_DIRECT_URL`.
- `pnpm dev:admin` overrides the mobile/tunnel API URL and calls the local API at `http://localhost:4000` by default. Reverse-proxy/ngrok API traffic is supported through explicit `TRUST_PROXY_HOPS` configuration so Express rate limiting can safely interpret forwarded client IPs.
- `pnpm db:migrate` now executes the runtime Drizzle migrator directly from the database package, normalizes Neon SSL modes to explicit `verify-full`, and prints the underlying PostgreSQL code/detail/hint instead of only a recursive pnpm failure.
- Server owns authorization, venue ownership, entitlement, live availability, confirmation price, promotion validity and notification fan-out.
- One Venue Owner account maps to exactly one managed venue after setup, and that venue has exactly one active court. A second court requires a separate account and separate Venue Owner subscription. The internal area/court row remains as a compatibility key for bookings, competitions, blocks, promotions, and historical records; extra historical court rows are inactive and never exposed as owner-selectable inventory.
- Weekly timetable operating periods carry their own AFN slot price. This supports higher Friday/evening prices and other time-band pricing; live availability, online booking confirmation, owner calendar slots, and default manual-booking price inherit the matched timetable-period price.
- Venue Owner Timetable Week and Day views are color-coded slot-management surfaces. Slots show start time + price, and tapping any slot opens status-aware management for available, online/manual booking, promotion, block, competition, or closed states.
- Premium trial is exactly 72 hours and starts explicitly.
- Booking/manual booking/blocks share one occupancy source of truth.
- PostgreSQL booking/block writes serialize per playing area with a transaction-scoped advisory lock.
- Cached availability is read-only orientation data; live server confirmation is required for booking.
- Promotions reference exact live future inventory; they do not create separate capacity.
- Promotion discounted price is applied server-side to live availability and persisted at booking confirmation.
- Booking, blocking, expiry, suspension or entitlement loss invalidates active promotion inventory.
- Social follows are scoped to `VENUE`, `TEAM`, or `COMPETITION`. Existing venue follows are backfilled into the generic follow model; follows do not expose private entity/customer data.
- In-app notifications are persisted server-side and deduped by user + event key.
- Marketing notifications are limited to 3 per user per rolling 24 hours.
- Push foundation stores Expo push devices and PENDING delivery/outbox rows; no external push dispatch worker/provider is enabled yet.
- Player identity is separated from private auth/contact data; public player/team DTOs never expose phone/email.
- Players can belong to multiple teams; membership uniqueness is scoped to one user + one team.
- Team-manager authority is object-scoped to the team's current `managerUserId`; UI visibility is never an authorization boundary.
- Team invitations expire after 7 days, are single-use, and are deduplicated while pending per team/player.
- Every normal authenticated account can participate as a player and reserve venue time. Team creation/management requires an active paid Team Owner subscription; a Team Owner can add normal users as players scoped to that team. A Venue Owner can assign normal users as referees scoped to that venue.
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
- `0009_password_reset_cooldown`
- `0010_paid_role_subscriptions` — paid Venue Owner/Team Owner entitlements, venue-scoped referees, existing paid-role grace backfill, and venue pricing alignment to 1000 AFN/month. — authoritative last successful credential-reset timestamp for the 72-hour cooldown.
- `0011_normal_user_social_feed` — generic Venue/Team/Competition follows, unified social posts, likes/comments, and backfill of existing venue follows/posts for the Normal User Home feed.
- `0012_team_join_requests` — user-initiated team join requests with one pending request per user/team and response history for Team Owner approval/rejection.
- `0013_social_comment_interactions` — social comment likes, ownership-aware edit/delete interactions, and related indexes.
- `0014_competition_control_center` — competition control-center extensions and operational scheduling/statistics data.
- `0015_venue_timetable` — versioned weekly venue timetables, periods, date exceptions, and owner timetable calendar support.
- `0016_single_court_slot_pricing` — enforces one active court per venue, preserves legacy court history by deactivating extras, and adds/backfills per-period timetable slot prices.

The user previously reported Phase 6 migration `0005_robust_smiling_tiger.sql` applied successfully. The user also reported Phase 7 migration `0006_phase7_commercial_core.sql` applied successfully. Phase 8 itself had no database schema change. Pre-release corrections have added later canonical migrations through `0016_single_court_slot_pricing.sql`. Migration `0016` is committed but must not be marked applied until the user runs `pnpm db:migrate` successfully after pulling this update.

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

- Public Venue and Team pages use profile-style presentation for social-post author navigation, with clearer identity, follower/member facts, actions, and structured content sections.

- Venue Owner Dashboard top navigation is a single horizontally scrollable, non-wrapping row: Competitions → Venue Time Table → Media → Analysis → Venue Settings. Destinations are `/owner/competitions`, `/schedule`, `/owner/posts`, `/owner/analytics`, and `/owner/onboarding`.

- Venue Owner Competition control center uses Overview → Teams → Fixtures → Standings/Bracket → Referees → Statistics → Media → Settings, with League, Group + Knockout, and Knockout formats; lifecycle/status actions; team invite/approval/removal/reseed; fee tracking; fixture generation/scheduling; venue-referee assignment; results/corrections; automatic standings/brackets; player statistics; competition media/follower notifications; safe Draft/Cancelled deletion; Completed archival; and clean Draft duplication.

- Venue timetable Week and Day slot cards now use a single top-left status marker rule: online reservations, manual reservations, and competition slots show a check mark; promotion/discount slots show a percentage symbol; other slot statuses show no corner status symbol.

- Mobile connectivity banners now debounce API health transitions: one transient `/health` probe failure no longer declares the server unavailable; three consecutive failures confirm an outage, and two consecutive successes confirm server recovery.

- Timetable slot actions close the native slot-management modal before navigating. Manual Reserve now opens reliably from an exact available/discount slot, reuses the slot court/time/price without a redundant owner-status request, and returns to the exact booked day after success.

- Venue timetable calendar navigation now uses localized Previous/Next text controls instead of directional chevrons in Month, Week, and Day views.

- Venue timetable calendar keeps Today on a separate full-width row above Previous / date-range / Next navigation, preventing overlap on narrow screens and in RTL.

- Mobile API reads now use a scoped two-tier cache for responsiveness: fresh read-mostly data can come from memory/AsyncStorage without another request, duplicate in-flight GETs are coalesced, private owner/booking/notification/team-invitation data is memory-only, live availability/auth/admin/account-status reads bypass the generic cache, network failures may fall back only to stale cached reads, and successful writes invalidate affected cache scopes before subsequent reads.

- Venue timetable Month/Week/Day navigation now immediately replaces the slot content area with a centered loader plus calendar-shaped skeleton while the requested range loads; Today, Previous/Next, view switches, month date selection, and Open Day all trigger the same slot-area loading state.

- Venue Time Table sub-navigation now shows only Calendar, Special Hours, and Weekly Timetable. Manual Reserve and Close a Time remain fully implemented routes/actions but are intentionally hidden from the nav because they are opened from individual slot management.

- Venue Time Table now names the date-exception tab **Special Schedule**. It manages one-off date overrides without changing the weekly timetable: upcoming/past history, full-day closure, custom opening periods, per-period AFN pricing, copy-from-regular-schedule, edit/delete/view-day actions, duplicate-date prevention, past-date protection, published-weekly coverage requirement, and occupancy conflict protection for bookings/blocks/competition matches.

- Venue Owner **Media** is now the venue's page/publishing control center. Owners can create General, Announcement, Promotion, Competition, and Result posts; link active discounted slots or owned competitions; generate result copy from completed matches; choose Public, Followers-only, or Private audiences; publish immediately, save drafts, or schedule publication; and attach multiple future lifecycle actions (publish, unpublish, audience changes, private, delete). Pending automations are persisted server-side and processed every minute by the API lifecycle worker, so they survive app restarts and do not depend on the owner keeping Media open.
- The Media dashboard supports post filters, status/audience management, edit/delete, pending automation cancellation, publication controls, and a direct preview of the public venue page. Venue pages are searchable by name, followable, and now include the venue's Media timeline. Public posts are visible to everyone, Followers-only posts require a follow relationship, and Private posts are excluded from public/social access including direct comment/post URLs. Venue posts reuse the existing Home social conversation graph for likes/comments/shares rather than creating a second interaction system.
- Media lifecycle storage is introduced by migration `0017_media_center.sql` (post type, visibility, notify-followers state, and `venue_post_scheduled_actions`). Pulling this Media update therefore requires `pnpm db:migrate` before restarting the API.

- Venue Owner **Media** now opens as the venue's editable social page rather than a plain admin list. The page has a Facebook-style cover/banner, overlapping venue profile photo, venue identity/bio, follower and post counts, View-as-visitor/Edit-page actions, a "What's happening?" composer, quick Photo/Competition/Discount/Result publishing shortcuts, post-state filters, insights, and feed-style managed post cards with audience, publication, comments, automation, edit, and delete controls.
- Media images no longer require owners to paste an HTTPS URL. Post photos, venue profile photos, and cover/banner images can be selected from the device **Gallery** or **Files** using Expo native pickers. Uploads are validated as JPG/PNG/WEBP/HEIC/HEIF with a 6 MB maximum, stored durably in PostgreSQL through capability-style media asset URLs, and rendered through the API on the owner page, public venue page, venue search cards, Home/social feed, post detail, and comments.
- Migration `0018_media_page_assets.sql` adds venue page profile/cover/bio fields and durable `venue_media_assets` storage. This update also adds `expo-image-picker` and `expo-document-picker`; after pulling, run `pnpm install` and `pnpm db:migrate` before restarting the API/mobile app.

- Venue Owner **Analysis** is now a full decision dashboard with six views: Overview, Revenue, Bookings, Customers, Marketing, and Competitions. Owners can use 7/30/90-day presets or a custom date range and compare revenue, booking volume, occupancy, and cancellation rate with the immediately preceding period.
- Analysis now uses the published/archived **Venue Time Table plus special-date exceptions** to calculate scheduled court capacity, instead of relying only on legacy opening hours. It separates booked minutes, competition minutes, blocked minutes, productive utilization, remaining capacity, weekday occupancy, and peak booking hours.
- Business metrics now include booking revenue, cancelled booking value, average booking value, revenue per booked hour, confirmed/cancellation rates, online/manual mix, unique/repeat customers, promotion-attributed bookings/revenue/discounts, venue followers and new followers, post likes/comments/engagement, competition/team/match activity, paid registration fees, daily revenue, cancellation reasons, and privacy-safe customer aggregation.
- Analysis adds automatic owner insights for strong/weak occupancy, cancellation pressure, repeat-customer health, promotion conversion, and peak demand patterns. The complete dashboard is localized in English, Dari, and Pashto and protected by `verify:analysis` in the main verification chain.

- Venue Owner **Venue Settings** is now a dedicated final-tab control center instead of redirecting owners back into onboarding. It has General, Booking, Court, and Access & Management sections plus live venue/subscription/verification/online-booking status cards.
- General settings manage public/WhatsApp phone numbers and optional latitude/longitude while preserving the existing physical-venue identity lock after a trial/subscription starts. Court settings manage the single court's name, default session duration, and fallback base price, with Weekly Timetable and Special Schedule kept as the authoritative per-period/per-date scheduling and pricing surfaces.
- Booking settings now control whether new online bookings are enabled, Instant vs Owner Approval confirmation, minimum booking notice (0–10,080 minutes), maximum advance-booking horizon (1–180 days), and the cancellation-policy text copied into new bookings. Pausing online booking hides new public slots without deleting existing reservations; booking-window rules are enforced in both availability and booking creation.
- Owner Approval mode is complete end-to-end: online bookings are stored as PENDING, remain occupancy-safe, appear in Venue Time Table with a Pending Approval badge, and can be approved or cancelled directly from the slot manager. Confirmation sends the existing booking-confirmed notification when applicable.
- Customer-facing venue pages now show whether online booking is active, Instant/Approval mode, minimum notice, maximum advance window, and the current cancellation policy before a player books. Existing bookings preserve their original cancellation-policy snapshot.
- Access & Management links owners to subscription/billing, Media/public page, referee access, and owner account profile, while reinforcing the one-court-per-owner-account/subscription rule. Migration `0019_venue_booking_settings.sql` adds live booking-control fields and `verify:venue-settings` guards the complete workflow.

- Venue Owner Media image uploads no longer convert selected local images through React Native `Response.blob()`. The mobile uploader now uses Expo SDK 57's native `File` from `expo-file-system` and named `expo/fetch` to send the local image file directly as the request body. This removes the Android React Native Blob/base64 LogBox warning and avoids the extra in-memory/base64 copy while preserving the existing 6 MB limit, MIME validation, timeout, authentication, durable media storage, and public asset URL behavior.
- `verify:owner-media` now requires the native file upload dependency/path and rejects any reintroduction of `.blob()` inside `uploadVenueMediaAsset`.

- Venue Settings → General now includes an interactive **Google Map venue-location picker** using `react-native-maps@1.27.2`. Owners tap the map or drag the marker to the venue entrance; the selected point automatically fills the saved latitude (عرض جغرافیایی) and longitude (طول جغرافیایی) fields to six-decimal precision. Existing saved coordinates reopen at the saved marker; venues without coordinates start around Kabul, and owners can clear the location before saving.
- The map picker uses the Google provider in Expo Go and the existing Venue Settings PATCH flow, so no database migration is required. Production store builds will require the normal Google Maps SDK API-key configuration for the app binary. `verify:venue-settings` now guards the dependency, Google provider, tap/drag marker behavior, automatic latitude/longitude assignment, read-only coordinate display, and localization.

- Profile → Venue Owner → Manage Subscription now presents the paid-access deadline as a localized Afghanistan-time **date and time on separate lines**, with a plain-language explanation of when management access ends and an appropriate past-tense label for expired subscriptions. English, Dari, and Pashto copy avoids raw UTC/ISO values; invalid timestamps are not shown to owners.
- On active Venue Owner subscriptions, **Open venue tools** now opens `/owner/competitions` (the Venue Owner dashboard with persistent top navigation) rather than the shared social Home feed. Team-owner navigation remains unchanged. Regression guard: `pnpm verify:role-subscription`, included in `pnpm verify`.

- **Media → Files upload correction (October 8):** use the Android/system Files image picker with `image/*` and an accessible cache copy, fall back to filename MIME for generic providers, copy transient `content://` URIs to app-owned cache before Expo native file upload, and validate the actual file size. Localized errors now distinguish unsupported files, inaccessible cloud files, oversize, connectivity and image preview failure. A selected file can be previewed locally once the server confirms the uploaded asset; its durable server URL is still saved to venue media. `verify:media` covers the fallback and upload path.

- **Venue Settings → General → Venue Location (October 8):** a prominent “Choose location on Google Maps” action opens a full-screen Google map. A tap or draggable pin previews the entrance coordinates, and explicit confirmation copies six-decimal latitude and longitude into the read-only inputs. Cancel leaves existing coordinates untouched; “Save Venue Settings” persists them via the existing API. The smaller inline map remains as a fast selection/preview surface. The native Google Maps provider is retained and checks cover both flows and RTL translations.
- For standalone Android APK/AAB builds, `apps/mobile/app.config.js` passes `GOOGLE_MAPS_ANDROID_API_KEY` (configured at build time, restricted by package and signing SHA-1) to the `react-native-maps` plugin; Expo Go needs no app-specific map key. Native builds made before key configuration must be rebuilt for tiles to work. No database migration is needed.

- **Venue Settings location control correction:** Latitude and Longitude are now displayed as two stacked read-only fields with a clearly labeled **Google Maps button immediately beside them**, visible as soon as the Venue Location section appears. Tapping opens the full-screen Google map (not the former 320px embedded map); tapping or dragging the pin and confirming copies both coordinates into the inputs. Owners still press Save Venue Settings to persist the coordinates. The control and its placement are regression-checked by `verify:venue-settings` and localized for English/Dari/Pashto.

- **Venue Location blank Google tiles workaround (October 8):** Some Android Expo Go SDK 57 devices show only the Google logo/background in `react-native-maps` without an error. The full-screen Venue Location selector now defaults to an independent OpenStreetMap/Leaflet WebView map, with native Google Maps as a second option. Tapping or dragging the map marker populates both coordinates. Loading failures display a localized message and latitude/longitude remain editable in the modal, so owners can continue even when tile networks are blocked. `react-native-webview@13.16.1` is pinned and lockfile updated. After pulling, `pnpm install` is required; no migration. The community OSM tiles are a low-volume development fallback, not a production SLA: configure a properly licensed hosted map-tile service before scaling.

- **Venue Settings → General → Address preview (October 8):** The address in Venue Identity is now displayed as the Address label with a localized **View address** button. Opening it shows a read-only modal containing the previously saved province, city, and full street address; if a location pin was saved via Venue Settings, a noneditable map centered on the **persisted server coordinates**, the latitude/longitude, and an optional **Open in Google Maps** action are shown. No existing venue identity/address is edited, and unsaved map edits are not passed off as saved coordinates. When no pin exists or map tiles fail, the text address remains available with a clear message. English/Dari/Pashto and the Venue Settings regression verification cover this behavior. No database migration or new dependencies.

- **Premium Futsal identity refresh (October 8):** the product's brand mark is a blue/silver futsal ball centered inside an illuminated indoor goal and stylized futsal court. SVG source is `apps/mobile/assets/branding/premium-futsal-logo.svg`. A reproducible Python/CairoSVG generator emits 1024×1024 opaque launcher and transparent-margin Android adaptive icon PNGs. `apps/mobile/app.json` uses the same mark for the launcher and Expo splash and a matching navy adaptive background, and `AppHeader` plus the navigation drawer display the mark next to the Futsal name. A path-scoped CI workflow regenerates and commits PNGs to `main` when vector brand source changes. `pnpm verify:branding` checks the installed native app assets; changing the home-screen launcher icon requires rebuilding the APK, while the in-app header logo updates through Expo Go/Metro refresh.

- **Branded onboarding/login (October 8):** the shared AuthHero on login and registration now displays the same premium futsal-ball/indoor-venue emblem used by launcher, adaptive, splash, and in-app header; removed the old solid green football icon and aligned its highlights with the app's blue/cyan sports palette.

- **Account Profile avatar picker (October 8):** Replaces the manual HTTPS profile-image URL field with native **Gallery** and **Files** selection for every registered user, regardless of paid roles. Supports crop-to-square Gallery flow, cached Android `content://` document imports, size/type/signature validation (6 MB max, JPG/PNG/WEBP/HEIC/HEIF), explicit loading and localized errors. The authenticated `POST /api/v1/users/me/avatar` endpoint atomically stores a single image per account in the new `account_profile_images` table and updates the user's durable opaque avatar URL. Existing PNG/JPG social comments, Profile and app header render internal profile URLs through `resolveMediaImageUrl`. On success the auth session is refreshed, so the avatar is visible without sign-out. General Account Profile Save preserves previously uploaded images when URL omitted. No third-party media host or additional client dependencies. Migration `0020_account_profile_images` **required** before uploading. Run `pnpm verify:avatar` and the API tests. Older native Expo Go still works; a native app rebuild is not needed because pickers were already installed.

- **Relative post timestamps (October 8):** Posts in Home/social feed, Venue Owner Media list, venue public page and post detail now show localized elapsed time such as “44 minutes ago”, “12 hours ago”, “1 day ago” rather than the absolute publication date and time. Calendar dates still appear for scheduled automation actions and booking controls, as those are future decisions. English/Dari/Pashto labels and numerals use `Intl.RelativeTimeFormat`; <1-minute posts display “now”, and week/month/year scale automatically. Each screen updates post labels every 60 seconds and on returning to foreground, without one timer per post. Run `pnpm verify:post-time`. No migrations or dependencies.

- **Logo simplification (2026-10-08):** Replaced the previous glossy indoor-venue/centered-ball emblem with a **flat, three-color futsal goal and white football in the goal's upper-right corner**. No glow, shine, gradients, text, or complex decorative effects. Solid brand blue `#145BD5`, clean white goal and ball, restrained blue football panels; designed to remain legible in small app-header and launcher sizes. Updated `apps/mobile/assets/branding/premium-futsal-logo.svg` (existing source filename retained for compatibility), launcher/adaptive generator, adaptive system background, and branding regression verification. The existing in-app header, drawer, login/register, and splash continue to use the same `assets/icon.png` artifact. GitHub's branding workflow renders the 1024x1024 PNG assets and pushes them to `main`; Android adaptive foreground is transparent and fit to the mask safe area. App launcher changes require a new Android APK; Expo Go can display the new in-app logo after pulling and restarting Metro.

- **Expo Go/Hermes crash hotfix (October 8):** Fixed login-to-Home crash `undefined cannot be used as a constructor` in `formatPostTimeAgo`. Android's JS runtime does not always support `Intl.RelativeTimeFormat`; both screenshot errors originated from this throw (render error plus AppCrashBoundary console log), not separate failures. Relative post times now use safe explicit English, Dari and Pashto units/digits for now, minutes, hours, days, weeks, months and years; zero dependency on optional Intl constructors. `verify:post-time` additionally executes the formatter in a VM with Intl.RelativeTimeFormat and Intl.NumberFormat absent. No migration required for this hotfix.

- **Approved player + FUTSAL wordmark (October 8, latest):** Replaced prior goal-and-ball app identity with the user-approved black silhouette player kicking a ball alongside the blue italic `FUTSAL` wordmark. Original generated visual comes from the prior in-chat approved Futsal image; the checked-in compact WebP `apps/mobile/assets/branding/futsal-player-logo.webp` is its native source. GitHub CI regenerates 1024px launcher and transparent-safe-zone Android adaptive PNG assets using Pillow; app header, login/register, drawer and splash all reuse the PNG logo. Android adaptive background is white to match the wordmark. The old SVG remains archived but unused by the build. `pnpm verify:branding` asserts the approved WebP exists and generated assets are valid. The splash and app launcher icon need a new native APK build to change, while Expo Go UI asset updates with Metro cache clear.

- **Approved text-free logo and simpler header (October 8):** User approved the generated black-and-blue futsal player kicking a ball with no FUTSAL wordmark. Updated the checked-in `apps/mobile/assets/branding/futsal-player-logo.webp` source to this exact image; `scripts/generate-futsal-logo.py` creates the Android launcher, adaptive foreground and Expo splash icon from it. The top `AppHeader` still displays the localized app name “Futsal” beside the icon, but no longer renders `profile.headerSubtitle`/“Futsal society reserve” under the title. The shared login/register hero retains its own text. `pnpm verify:branding` checks the approved asset SHA-256 and the absence of the header subtitle. The branding workflow pushes generated PNG icons to `main` after the source commit. Native Android launcher/splash changes require a rebuild; in-app header icon/title refresh through Expo Go.
