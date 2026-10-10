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
- Primary mobile navigation uses the shared header: hamburger drawer fixed at top-left, profile image/avatar fixed at top-right, and the previous bottom tab bar is hidden. For every non-admin account, the menu contains exactly one Dashboard item: Home → Dashboard → Venues → Teams → Competitions → My Reserves → Profile. `/dashboard` resolves the signed-in user's role (Venue Owner → owner shell, Team Manager → team shell, Player/normal account → player shell, Referee → referee view); Platform Admin uses its separate admin menu. Home remains the shared social feed.
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

- **Facebook-style public Home and shared top navigation (2026-10-08):** Home, Venues, Teams, Competitions and Notifications now have one consistent five-icon navigation bar directly beneath the fixed Futsal header, outside the scrolling page content. Accessible selected state, strong blue underline, Dari/Pashto RTL reversed icon order, and actual unread notification badge (from the existing authenticated notifications endpoint) are supported. The bar remains visible during data-loading/empty states and works for Normal User, Player, Venue Owner, Team Manager and Referee. PLATFORM_ADMIN has no public bar and uses a distinct administrator hamburger path to /admin; the existing role-specific Dashboard item in the regular hamburger is preserved. The Home page has a compact recent-posts heading and keeps working Like/Comment/Share and localized relative timestamps. Feed selection now blends recent posts from followed venues/teams/competitions (3 slots) with publicly visible recommendations (1 slot) without leaking follower-only/private posts. The new users' feed can show public posts even with zero follows. Role-restricted actions remain enforced on the original screens. **Personal-user posts, Facebook friendship, group messaging and a post-composer are NOT included**; the present server supports venue/team/competition post authors. Check via `pnpm verify:public-home-nav` and `pnpm verify`. No new dependency or migration.

- **Facebook-inspired Social Home (October 8, 2026):** The shared Home of every non-admin role now opens with a profile-avatar status composer (“What's on your mind about futsal?”) and Photo action, horizontal real-photo **Futsal moments** with a “Share a moment” card and venue/team/competition discovery fallback, and a full-width social feed with compact author headers, localized elapsed-time labels, public identity, larger post media with fullscreen viewing, working Like/Comment/Share, expand-long-text, per-session hide, author-only delete and pull-to-refresh. The existing fixed five-icon public navigation and premium logo remain intact. For the first time free **personal user posts** are real: authenticated players and regular accounts can publish text and gallery/Android Files photos (5 MB, magic-header verified), see them in the Home feed and public person pages, and follow other people; venue owners use the same free personal composer while venue-page posts remain managed in Venue Media. SocialFeedPostDto and `social_entity_type` now include `USER`, and public personal updates integrate with existing social likes/comments/follows; a dedicated `social_user_post_images` table stores opaque-token protected uploaded assets. Only public personal posts are supported in this increment; no fictitious friendship, ephemeral 24-hour stories or messaging is presented. Required migration: `0021_social_home_user_posts`. Run `pnpm db:migrate`, `pnpm verify:facebook-home` and full `pnpm verify`. Automated integration tests cover guest rejection, content validation, normal-user publishing, public profiles, image signature checks, cross-user photo ownership, and author-only deletion.

- **Home feed heading removal (2026-10-09):** Removed the visible “Latest posts” title and followed/discovery subtitle above the public Home feed, along with the “Futsal moments” section title and “Photo updates” subtitle. Composer, photo-moments carousel, post cards and fixed header navigation remain unchanged and now flow together in a Facebook-style layout without extra headings. Removed the redundant refresh button from the former feed heading; swipe-to-refresh remains fully supported. Updated public navigation and Facebook-Home verification scripts to guard against reintroducing those headings. No migration or dependency changes.

- **Facebook-inspired comments sheet (October 9, 2026):** Tapping a post's Comment action now presents `posts/[postId]/comments` as a transparent slide-up modal on top of the public feed, instead of a separate title/subtitle form page. The panel has a rounded upper border, drag-handle cue, dismissible dim backdrop, compact post context and real Like/comment counters, a separately scrollable stream of RTL-aware circular avatars with gray comment bubbles, relative times, real comment reactions and author-only edit/delete actions. A keyboard-aware composer stays fixed at the bottom with the signed-in account avatar, multiline input and disabled-when-empty send action. Reply taps focus the composer and insert an @name mention, clearly **not** a persisted nested/threaded reply relationship (the existing API only supports flat comments). Added localized English/Dari/Pashto strings, profile routing for personal-post authors and comments, loading/retry/empty states and `pnpm verify:comment-sheet`. All existing comment API operations and ownership checks remain in place; no new dependencies or migrations. GitHub full verification must pass.

- **Followed Venues discovery (October 9, 2026):** Removed the large “Venues” title and “Find a venue with live bookable futsal time” subtitle from the shared Venues page. Its top content is now a horizontal, RTL-aware row of compact followed-venue cards showing the real venue-page logo (football fallback) and venue name. Show **exactly the first up to 10 venues**; only when the signed-in account follows 11 or more does an additional **Show more (+N)** card appear at the end of the row, opening `/venues/following`, a complete vertically scrollable followed venue list with logos, names and location. Both screens refresh followed venues on focus, so user follow/unfollow changes are reflected after returning. The authenticated `GET /api/v1/social/venues/followed` returns ALL active venues followed by the caller, via a single efficient joined query scoped to that account and ordered by latest follow. Search, city filter, public venue results, venue profile/booking, top public navigation, loading/error/retry/empty states remain. Translation is provided for English, Dari, Pashto; new repository/service/API contract, automated 12-follow account-isolation tests and `pnpm verify:followed-venues`. No DB migration or added package dependencies. **Important:** the carousel uses actual followed venues, not recommendations or the public search results.

- **Venue province filtering and autocomplete (2026-10-09):** On the shared Venues discovery page, replaced the manual City input with an accessible select-style Province control. The default is **All provinces**; choices are computed dynamically from province names of *currently active, entitled/subscribed* venues, never from a hard-coded Afghanistan province list. Selecting a province immediately filters results while keeping the existing followed-venue row intact. The venue search now supports case-insensitive partial matching against **venue name, city, province and street address**, and pressing Search or the keyboard action executes the combined query. While the user types, debounced real-time suggestions for matching venue names and location fields arrive via `GET /api/v1/venues/discovery`; selecting a suggestion fills the search and retrieves venues. Suggestions are capped at 8, filtered by selected province and excluded for inactive/expired venues. This endpoint uses a lean DB projection with subscriptions rather than fetching every venue's timetable. Search params are length-limited, and stale suggestion responses are ignored. Province picker and suggestions support RTL (English, Dari, Pashto), accessibility labels, cancel/selection, error retries and empty results. Booking and followed-venue navigation are unchanged. Added booking API tests and `pnpm verify:venue-discovery` to full CI. No migration or package install required.

- **Compact venue result cards (2026-10-09):** The Venues page search results and full Followed Venues list now share `VenueResultCard`, a responsive 25% image / 75% information card. Venue media is a centered **square** cropped from the real page cover photo (profile photo fallback) or followed profile image, with an illustrated placeholder if absent. The information column places venue name and city/province above two equally wide horizontal buttons: outlined **Venue Details** and primary-blue **Reserve Online**. English LTR and Dari/Pashto RTL layout are supported, with two-line button labels and touch-friendly actions. Details opens the public venue page; Reserve Online deep-links to the availability/date/slot section without creating any booking. Search results disable booking when `onlineBookingEnabled=false`. The followed list currently has no booking-enabled field in its summary DTO, so it links to the authoritative venue availability view, which rechecks the live server before booking; the small ten-item followed carousel remains untouched. Added English/Dari/Pashto translations and `pnpm verify:venue-cards` to full verify. No schema migration or new dependencies. Home remains the social feed and contains no venue search-result list yet.

- **Venue search input layout (2026-10-09):** Reordered the Venues discovery controls to show the **Province** selector immediately before the venue-name/location search input. Removed the redundant instructional hint rendered below the search field while retaining the label, placeholder, keyboard Search action, province-filtered suggestions, and explicit Search button. Updated `verify:venue-discovery` to catch future UI regressions. No dependencies or migrations.

- **Province default refinement (2026-10-09):** Venue discovery now selects **Kabul** on initial render and applies that province filter to the initial API listing, rather than displaying unfiltered results. The **All provinces** option remains in the province selector for later use, allowing users to clear the filter. The subscribed-provinces list stays dynamically sourced, and all search, suggestions and followed-venues behavior is retained. Extended `pnpm verify:venue-discovery` coverage. No dependency or migration.

- **Followed venue carousel actions and clarity (2026-10-09):** Each small followed-venue tile now has two distinct accessible tap areas: an enlarged image/name region with a blue **Venue Details →** visual cue (chevron direction mirrors in RTL), and a separate solid-blue **Reserve Online** button beneath it. Details opens the venue public page; Reserve Online deep-links to that venue's live availability without creating a reservation. The larger 148px-wide tiles leave room for localized text, and the Show more card is sized to align with the carousel. Existing actual follow data, ten-venue preview, overflow navigation, and English/Dari/Pashto strings remain intact. Added assertions to `pnpm verify:followed-venues`. No API, migration or dependency changes.

- **Most-followed and nearby discovery (2026-10-09):** Beneath the existing followed venues rail, two accessible blue buttons open Most Followed Venues and Venues Nearby. Popular ranks up to 15 currently discoverable subscribed venues by actual social follower counts using one grouped repository query; nearby ranks up to ten active subscribed venues with saved map pins by Haversine straight-line distance from a foreground, permission-approved device position. The app never saves or tracks device coordinates in the background. Markers on a map show each venue picture/name and open the familiar venue details/reservation actions. Graceful permission-denied, location timeout, no-pin, and map tile failures have retry/fallback UI. Permission strings are supplied in Expo native config. Supported in English, Dari and Pashto with RTL. Neither feature changes the followed rail or province defaults. No schema migration is needed.

- **Shared Venues-style Teams and Competitions discovery (2026-10-09):** Rebuilt public Teams and Competitions directories around a ten-item followed carousel (photo/identity, explicit details cue and entity-specific CTA), followed by two blue discovery shortcuts, select-style filters, search and a 25% square-image / 75% information result card with two buttons. Teams uses a city selector, team-name/city search, Most Followed Teams (top 15 from real social follow counts), My Teams, Followed Teams and permission-safe Request to Join with pending/member states. Competitions uses a status selector and competition-name-only search, Most Followed Competitions (top 15), Followed Competitions, and **up to ten IN_PROGRESS competitions at venues that the current account follows** (never a location/map approximation). Competition actions are state-aware: Registration Open links to the actual registration section; In Progress/Completed show standings, while other statuses open public details. New authenticated `GET /api/v1/social/discovery/:entityType` returns account-scoped followed IDs plus aggregated follower counts; entries themselves are cross-checked against the existing active team directory or public competition listing. Generic stats never expose other users' followed IDs. English/Dari/Pashto RTL translations, integration tests and `pnpm verify:social-directories` added. No DB migration or new packages.

- **Notifications Center overhaul (2026-10-09):** Redesigned public Notifications screen with a live unread summary, six horizontal filters (All/Unread/Bookings/Venues/Teams/Competitions), Kabul-local Today/Yesterday/Earlier groups, relative timestamps, blue unread highlights, icon-coded event cards, per-item overflow actions, safe deep links, pull-to-refresh and true server-side 30-item pagination. Mark individual/all read, delete one and clear only read notifications are authenticated and account-scoped; destructive actions require confirmation. The fixed top navigation uses server-global unread counts (not the first 100 items), and its badge updates immediately when inbox actions succeed. Notification preferences moved to a separate settings subpage with delivery/content toggle descriptions and rollback on failed saves. Backend adds typed filtered list metadata and atomic bulk operations without any schema change; push/dedup/frequency semantics retained. Event publishers now include structured venue/team names for localized contextual bodies; historical bodies retain a safe fallback. English, Dari and Pashto supported, with verification and isolation tests in `pnpm verify:notifications-center`. No migrations or new packages.

- **Notifications button styling correction (2026-10-09):** Fixed the user-reported vertically stretched filter pills caused by the unconstrained nested horizontal ScrollView: the filter rail is now locked to 52dp high with non-growing 44dp chips, center alignment, one-line labels and contextual icons. Reworked the unread summary so number/label and supporting text have their own horizontal space and **Mark all read** has a readable full-width 46dp touch target (including a clear disabled state). Turned **Clear read** into a compact outlined 44dp button with an icon; polished the header-settings and notification overflow buttons with pressed/active feedback. RTL visual order, EN/Dari/Pashto translations, pagination and API actions remain unchanged. `verify:notifications-center` now asserts sizing invariants to prevent reintroducing tall pills. No new dependencies or migration.

- **Public Competition profile redesign (2026-10-09):** Replaced the plain competition detail view with a venue-inspired profile: full-width cover (latest real published competition media image, otherwise a blue trophy banner), centered overlapping trophy avatar (no fabricated dedicated competition logo), name, venue location link, follow/unfollow, follower count, status/format badges, and team/match/result metrics. Below the header, a fixed-height 64dp horizontally scrolling, RTL-aware, six-tab section navigator offers **Home, Results, Matches, Standings/Stages, Stats, Teams**; tapping a tab loads content inline, rather than leaving the profile. Home retains authentic about/details, team registration with owner/team eligibility and deep-link scrolling, champion, latest results, next matches and media updates. Results lists completed/corrected scores; Matches lists pending, live, postponed and unscheduled fixtures; Stages adapts to league standings, knockout rounds, or Groups + Knockout switches; Stats supports switchable goal/assist ranking with player links; Teams shows accepted participants, logos and team links. Competition directory standings CTAs now open the appropriate profile tab. Existing /standings, /bracket, /stats and /teams links redirect to their corresponding in-profile tabs (including the knockout stage), so old shortcuts and bookmarks remain usable. Labels translated to English/Dari/Pashto and a profile-specific verifier added to full `pnpm verify`. No database migration or dependencies. Dedicated uploadable competition cover/logo can be introduced as an owner-editable feature in a later task.

- **Competition public profile content refinement (2026-10-09):** Added a dedicated **About this competition** screen at `/competitions/[competitionId]/about`, directly accessible from the profile header for logged-in and anonymous readers. It displays the actual name/description, venue link, format/status, accepted/max teams, registration fee/deadline/status, start/end times, match length/counts, competition scoring and tie-break rules, group/qualifier configuration (when applicable), and champion when available. Moved team registration (including managed-team selection, real API, and anchored deep-link) from Home to the **Teams** tab, updating registration shortcuts in the competition discovery directory and About page. Removed the Home About, champion, last-results and future-fixtures sections to avoid duplication; **Home is now a full, untruncated competition posts feed** with newest first. Only when one or more real match records have `IN_PROGRESS` status does a blue live scoreboard appear above posts; it uses real stored scores and is completely absent otherwise. Home live match state refreshes in the foreground every 25 seconds without a disruptive full-page spinner and when the app resumes, cleaning timers on blur or tab change. Results and Matches remain dedicated tabs. All new labels are localized to EN/Dari/Pashto; `verify:competition-profile` extended with content and navigation safeguards. No schema changes or new dependencies.

- **League-only standings layout (2026-10-09):** Reworked the public competition **Standings / Stages** tab when format=`LEAGUE` to follow the supplied LaLiga-style reference. A fixed 48%-width pane displays rank, real team crest or fallback, and navigable team name while a single horizontal 52%-width scroll viewport contains all synchronized statistics columns (P, W, D, L, GF, GA, GD, Pts) and the final **last five results** group. Header and row heights match on both sides, so horizontal gestures affect only the metrics and vertical gestures still scroll the parent profile. Recent form (green W, gray D, red L) is calculated from the team's actual five latest fully scored `COMPLETED`/`CORRECTED` LEAGUE fixtures, excluding in-progress, scheduled, cancelled, group/knockout games and absent scores; no sample status history is invented. Abbreviations, swipe hint and outcome accessibility are localized EN/Dari/Pashto with mirrored RTL pinned-column border/order. Other competition formats retain existing group and knockout tables. Added contract-level Vitest form cases, `pnpm verify:league-standings`, and extended the competition-profile regression guard. No database changes or new dependencies.

- **Public competition Matches and match-detail experience (2026-10-09):** Rebuilt the public Matches tab with an RTL-aware Google-results-inspired date-grouped fixture list showing both teams, real registered team crests, Kabul-local start time or actual score/status, stages/rounds, and tappable rows. Added All/Upcoming/Live/Finished filters; Results has the same readable fixture cards restricted to final/corrected scores. New public route `/competitions/[competitionId]/matches/[matchId]` opens a real match profile: two-team score header, start/end/venue/court/round, a separately loaded list of only recorded individual player appearances, goals, assists and cards, and a snapshot of the two teams' competition standings. Public API `GET /api/v1/competitions/:competitionId/matches/:matchId` checks the published competition, validates match membership, and returns only approved stored stats on completed/corrected matches. No fabricated injury timelines, lineup assignments, highlights or videos; unavailable items are explained in UI. Match profile refreshes every 25 seconds in foreground without losing content. Competition Home displays a blue team-registration call-to-action **only** while registration is open, positioned above the conditional live scoreboard and opening the Teams tab. League fixed-column team names now offer a real name+crest preview on pointer hover or tap/long press, dismissible with a View Team action. English, Dari, Pashto, RTL included, structural verification added with `pnpm verify:match-details` and existing league/profile verifiers updated. No migration or new packages.

- **Competition profile navigation simplification (2026-10-09):** Removed the redundant public `Results` navigation tab because scored finished matches are already available under **Matches → Finished** (both COMPLETED and CORRECTED). Public profile now has five tabs: Home, Matches, Standings/Stages, Stats, Teams. Matches retains All/Upcoming/Live/Finished filters, date-grouped match rows, and tapping a match still opens its detailed scorecard. Removed the old results-only duplicate-list branch. Historic links using `?tab=RESULTS` automatically open Matches with Finished selected. Existing scoreboard, registration CTA, standings, stats and team actions are preserved. Extended public competition profile and match verifiers to guard against reintroducing a duplicate Results tab. No DB migration or new dependencies.

- **Instant Like interaction on Social Home (2026-10-10):** Replaced the 2–3 second server-first post Like/Unlike rendering with an optimistic per-post state queue. A tap immediately flips the highlighted thumb and changes the visible count by one, without dimming or disabling Like while the API executes in the background. Rapid consecutive taps are coalesced into serial writes (last user's intent wins), and server acknowledgements reconcile the authoritative total without visual resets. Network errors rollback to the most recent confirmed state and display the localized Like error. Background feed fetches preserve pending likes and reject responses that started before a mutation; responses from a previous account are ignored. Pure optimistic-queue tests cover delayed response, rapid taps, count floor, rollback/retry and stale refresh; `verify:optimistic-likes` participates in `pnpm verify`. No migrations, dependencies or server behavior changes.

- **Owner Venue Settings browser crash fix (2026-10-10):** Fixed `TypeError: codegenNativeComponent is not a function` when Expo Router eagerly evaluates `owner/settings.tsx` on React Native Web. The screen no longer statically imports `react-native-maps`. Native Google Map and draggable pin behavior are isolated in `VenueGoogleMap.native.tsx`; the web implementation and TypeScript neutral entry never import native maps. The existing Android WebView Leaflet picker remains intact; browsers now use a real Leaflet `srcDoc` iframe with click-to-pin, drag-to-reposition, and validated origin-scoped message handling instead of importing native `react-native-webview`. The Google-only map option is hidden on web, while OSM + persisted latitude/longitude remain fully interactive there; both choices remain on Android. Extended `verify:venue-settings` to assert native/web import isolation, full-screen picker behavior, and validated browser map events. GitHub release CI now builds web output explicitly as a bundling smoke test after the full verify. No database migrations or package additions.

- **Public navigation labels & account default location (2026-10-10):** The five fixed top navigation destinations (Home, Venues, Teams, Competitions, Notifications) now display their localized labels below the icons with a compact 64dp bar, active tab color/underline, RTL reverse order and existing unread badge. An account-private, optional default latitude/longitude pair can be selected from an interactive map in **Profile → Account**, manually edited, saved or cleared. The authenticated User DTO and profile update endpoint carry the location, backend validates both numbers and pair presence, and DB migration `0022_user_default_location.sql` persists them with a pair/range CHECK. No public DTO exposes account coordinates. **Venues → Find Nearby** starts a ten-second deadline when the page opens (including permission wait); it uses live foreground GPS if available, otherwise after ten seconds, or immediately on permission denial, uses the saved default coordinates if present, with a clear fallback notice, retry-live button, and edit-location shortcut. Late GPS callbacks cannot overwrite the displayed fallback search. Without either live location or a saved default, retry and setup links remain. Web geolocation and Leaflet map use safe browser implementations; Android uses its native GPS probe. Regression tests verify privacy/isolation, validation, clearing, retention, UI logic, fallbacks, and multilingual labels. **After pulling run `pnpm db:migrate` before starting the API**, since this version adds user columns.

- **Competition profile selected-tab focus & organizer rewards (2026-10-10):** The public competition profile's existing horizontal five-tab navigation now measures tab positions/viewport and automatically scrolls the active tab into view (centered where possible) after initial layout, deep-link selection and every tap; retains blue selected underline and RTL order. Public **About this competition** now contains a dedicated **Rewards** section displaying owner-announced awards separately for teams and individuals (award title, prize and optional explanation), or an honest no-rewards state. Competition owner dashboard has a new **Rewards** management tab supporting draft add/edit/remove, distinct Team/Individual categories, duplicate/title/prize validation and explicit save/publish. Writes go through an authenticated rate-limited `PUT /api/v1/owner/competitions/:competitionId/rewards` endpoint, the same premium ownership checks as other competition mutations, and are prohibited after archive/cancellation. New migration `0023_competition_rewards.sql` adds a default-empty JSONB array to competitions; private/unpublished competitions do not expose awards publicly. About registration/start/end date displays now format actual Kabul calendar dates and time (hour/minute only), no seconds or GMT +4:30 suffix. English/Dari/Pashto UI, `verify:competition-rewards` and API reward tests included. Run `pnpm db:migrate` after pulling; no new packages.

- **Venue Owner team registration in public competition Teams tab (2026-10-10):** When registration is open, a hosting Venue Owner may choose from a searchable active team directory and use **Invite team** directly in the competition Teams tab. Actual ownership is verified against the competition's hosting venue; another venue owner cannot invite there. Duplicate active/pending/accepted teams are excluded. Invitations require the existing Team Manager acceptance before enrollment, protecting unrelated teams. The separate self-registration flow for managers of their own teams remains available, including to dual-role users. English/Dari/Pashto guidance explains this manager-consent step. Covered by `pnpm verify:competition-organizer-invite` and a cross-venue API permission regression. No migration or package additions.

- **Offline/manual teams and subscription handover (2026-10-10):** Venue Owners can create/edit venue-scoped offline teams from their new **Offline Teams** dashboard tab (name/city only, manager user ID initially set to owner, no team membership/account). This registers a distinct existing `teams` identity with `offline_venue_id` and nullable `claimed_at`, preventing creation of a public team page, social posts, follow actions, directory listings or player roster management. From the public competition Teams tab and owner competition management Teams tab the host can add their own offline teams **directly as ACCEPTED** (no paid Team Owner subscription, no invitation/manager acceptance); normal subscribed team invitation and self-registration paths remain. Host venue ownership, Premium write access, competition structure phase and maximum team capacity are enforced inside a serialized transaction. Offline teams appear by name in standings, match results and competition lists but have no clickable team profile link. A Platform Admin sees all unclaimed offline teams in the Admin **Offline team handover** section and transfers one to a subscribed user after entering BOTH matching username and Afghanistan phone; target must have an ACTIVE nonexpired Team Owner subscription. Claim transaction serializes against other claims, creates the new manager's active team membership/profile, switches manager, changes to public team, and records an audit entry while preserving the original team ID, competition entries and history. Owner loses management after claim. Migration `0024_offline_competition_teams.sql`, verification `pnpm verify:offline-teams`. Run `pnpm db:migrate` after pulling before starting the API. No package changes.

## Team Manager Dashboard — Phase 1 (2026-10-10)

Implemented and merged to main **only Phase 1 (Core Team Management)**. Dashboard no longer displays the generic "Dashboard" heading/subtitle for Team Managers; replaced with four horizontally scrollable, selected-state tabs: Overview, Team, Players, Settings. Supports team selection, no-team creation/invitation onboarding, subscribed management/read-only gating, database-backed real match and competition counts and upcoming fixture, notifications, edit team identity and privacy, optional public profile details (province, district, description, founded date, team colors, contact, preferred venue), join-request preference enforced in team service, registered-player management/invitations/join-request approval, and offline guest roster CRUD with distinct jersey numbers. No guest player receives a platform login or official match lineup. Public team profile displays appropriate public fields, not private management controls.

New DB migration `0025_team_manager_phase1`, schema tables `team_manager_profiles` and `team_guest_players`. Run `pnpm db:migrate`. Verification: `pnpm verify:team-manager-phase1` plus full `pnpm verify`.

Explicitly **not yet implemented**: Phase 2 Competition Operations (dedicated Competitions, Matches, Schedule tabs; roster by competition, lineups, event RSVP) and Phase 3 Growth and Engagement (Media, Statistics, friendly challenges, achievements). Existing public competition browsing and team management routes stay available; nothing new from Phase 2 or 3 is presented as completed.

## Team Manager Dashboard — Phase 2 (2026-10-10)

Phase 2 implemented on main with three additional tabs **Competitions**, **Matches**, and **Schedule**. The Phase 1 dashboard (Overview, Team, Players, Settings) is preserved. Competitions tab shows team-specific invitations/applications/current/completed events with direct reuse of verified registration/respond endpoints, filters, public competition discovery, and a manager-controlled per-competition roster with organizer deadline locks. Match tab shows all official fixtures, opponent scores/status, date/time in Kabul, and private per-match starters/substitutes/captain. Managers **cannot edit official scores**, and the server limits lineups to accepted registrations and active members in the competition roster. Schedule tab combines live fixture data (always re-read from organizer records) with private training/team event CRUD, day/week/month navigation, and player RSVP (available/unavailable/unsure). Members receive in-app/push notifications when their manager creates, changes or cancels team activities, subject to their notification preferences. A members-only activities route from the team's public page allows players to give their own availability; nonmembers cannot access it.

Migration `0026_team_manager_phase2`: `team_competition_roster`, `team_match_lineups`, `team_activities`, and `team_activity_responses`. Roster has composite FK to the exact competition/team registration and active member checks at the API; team activity responses require membership, all management mutations active subscription. Booking venue reuses existing public venue booking flow. Dedicated media/statistics/friendly challenges and achievements are Phase 3, not Phase 2.

After pull: `pnpm db:migrate`, `pnpm verify:team-manager-phase2`, `pnpm verify`. Changes delivered only after CI checks.


## Team Manager join request Accept/Reject hotfix (2026-10-10)
- Root cause: mobile team-manager `respondJoinRequest` incorrectly sent `POST /api/v1/teams/:teamId/join-requests/:requestId/respond`, whereas the existing protected server route is `PATCH /api/v1/teams/:teamId/join-requests/:requestId` with JSON `{accept:boolean}`. Both buttons therefore returned 404.
- Corrected the mobile API client to match the existing server contract. Added request-specific in-flight action feedback and visible inline errors in Players > Join Requests. On successful decision, the row is updated immediately and roster/details are refreshed.
- Added request-level Supertest coverage for both Accept and Reject: authorization, state transition, membership change, pending-list refresh and duplicate-conflict. Added invariant check `pnpm verify:team-join-requests` to the full verification chain.
- This is a targeted UI/API contract repair: no schema migration or changed competition/venue semantics.

## Team Manager Dashboard — Phase 3 (final scope, 2026-10-10)

Implemented the final dashboard stage on main. Nine tabs: Overview, Team, Players, Competitions, Matches, Schedule, Media, Statistics, Settings. Phase 3 adds Media (team public posts with independently owned in-app photo uploads; edit, unpublish, existing social feed likes/comments; members-only announcements with notifications) and Statistics (official, finalized match-only played/win/draw/loss/goal totals, per-player recorded goals/assists/cards/clean sheets/awards, competition history, verified knockout championships based on the completed final winner). Organizer-advertised prizes are marked as offered, **not automatically awarded**. Friendly match challenges live in Matches, supporting proposing time/venue/message, opponent acceptance/decline, sender cancellation, manager notifications and preserved history. Friendly agreements do not create an official competition fixture, official score, or automatically book a venue.

Authorization: all private workspace reads check manager ownership; member announcements are exposed only to current registered members; every write checks manager ownership and active Team Manager role subscription; uploaded image references are validated against asset ownership; source/recipient and status conditions guard challenges. No unclaimed offline teams can enter the manager workflow. Date/time displayed in Kabul timezone with Dari/Pashto/English localizations.

New migration `0027_team_manager_phase3` creates tables `team_friendly_challenges`, `team_announcements` and notification types. Verify with `pnpm verify:team-manager-phase3` and full `pnpm verify`; run `pnpm db:migrate` after pulling main.

Not implemented: real video uploads/storage, automatic friendlies venue reservation, direct team chat, player recruitment marketplace or universal team ranking score (these were optional later ideas, not within the three-stage manager dashboard scope). External award fulfillment must be recorded by an authorized organizer to be claimed as received.

## Player Dashboard — Phase 1 / Foundation (2026-10-10)
- New player dashboard available to ALL signed-in normal accounts, even without an explicit PLAYER role. `/dashboard` opens Player Dashboard for normal or PLAYER-only accounts; the existing direct `/dashboard/player` URL stays available for compatibility and paid-role users needing the player view but no longer appears as a second hamburger item. Existing role-dashboard routing remains unchanged for paid roles.
- Horizontal nine-section player dashboard: Overview, My Teams, Competitions, Matches, Schedule, Statistics, Achievements, Bookings, Settings. Premium blue selected-tab underline, icons and labels, focus-centering for active tab, Dari/Pashto RTL item reversal, full en/Dari/Pashto strings, no redundant generic heading.
- Phase 1 content: real player profile card, current default team, official recorded statistics summary (current teams), next scheduled fixture from competitions, upcoming team activities, invitations, outgoing join requests, and recent officially completed player match performances. Empty and error/loading states cover missing data.
- My Teams: multi-team member cards and team selection, real invitation accept/decline endpoints, outgoing request history and cancellation, team discovery/request-to-join, membership-safe team leaving, and team activities links. Team owners cannot bypass management transfer. Leaving preserves historic official game data and clears captain/default team references; no duplicate team business logic.
- Settings: existing player profile editing link plus private persisted career preferences (bio, province/district, secondary playing position, preferred foot), and server-validated active-membership default team. Sensitive career preferences are **not made public** in Phase 1; main global account notification/security settings remain under Profile. Player-only dashboard never requires paid subscription.
- Other six tabs are wired as accessible placeholder panels with links to existing competition, schedule/activity and booking features, ready for Phase 2/3. No fake statistics, achievements or fixtures.
- API: `/api/v1/player-dashboard`, `/preferences`, `/join-requests`, `/join-requests/:requestId/cancel`, `/teams/:teamId/leave` with scoped writes and input validation. Schema migration `0028_player_dashboard_phase1.sql`; check `pnpm verify:player-dashboard-phase1` added to workspace full verify.
- Next: Phase 2 fills Competitions, Matches, Schedule and Bookings with detailed player activities, then Phase 3 adds verified career statistics, awards and release polish.

## Player Dashboard — Phase 2 / Player activities (2026-10-10)
- **2.1 Competitions:** the registered competitions of a player's active teams, with team/organizer status, venue, competition format, start date, and explicit per-player competition-roster selection. Players cannot register their team, add themselves to rosters, or change organizer rewards through this view.
- **2.2 Matches:** official fixtures from all active teams, upcoming/live/completed/all filters, venue and competition links, finalized official scores, own manager-saved lineup selection (starter/substitute/not selected/not published) without revealing the full private lineup, and personal official recorded match statistics. Accepted manager-proposed friendlies are shown separately and are **not** described as official results or confirmed venue reservations.
- **2.3 Schedule:** unified all-team (or team-filtered) Kabul-local day/week/month calendar, official fixtures, team trainings/meetings/friendlies, accepted friendly agreements and personal confirmed/pending reservations. Time overlaps produce a visible warning, never automatic cancellation. RSVP actions for upcoming team activities call the existing membership-gated Team Manager service.
- **2.4 Bookings:** real authenticated `bookingApi.mine` data, upcoming/past/cancelled filters, venue and pricing information, protected venue navigation, explicit cancellation confirmation before existing `bookingApi.cancel`, and direct new-venue-booking entry. Personal bookings are **not** claimed to be owned by a team.
- **2.5 Integration:** read-only `GET /api/v1/player-dashboard/activities` uses `request.auth.userId`, existing team active-membership query, scoped competition teams/fixtures and only the requesting player's private roster/lineup/recorded statistics and RSVP state. No privileged manager mutations or subscription gate. Uses existing team activity and booking notifications from the app. Full en/Dari/Pashto localization, standard loading, retry/errors, guards and tests in `verify:player-dashboard-phase2`.
- There is no new database migration for Phase 2: it reuses existing team competitions, official fixtures, player stats, private lineups, friendly challenges, activity responses and booking tables. Phase 3 remains achievements, long-term player statistics, performance trends, privacy and release polishing.

## Player Dashboard — Phase 3 / Career and final dashboard polish (2026-10-10)

**3.1 Verified career statistics:** `GET /api/v1/player-dashboard/career` is authenticated and uses the caller's token identity only. Official appearances, goals, assists, clean sheets, cards, best player and W/D/L records come exclusively from `player_match_stats` attached to finalized `competition_matches`; absent or incomplete match scores never become guessed wins. Historical records survive removed team memberships; aggregate sums are deduplicated per match/player. All-time/year, team including former teams, and competition filters in the new Statistics tab.

**3.2 Performance history:** match history with official linked match details and a responsive monthly goals/assists/appearances bar chart; the bucket year/month is calculated in `Asia/Kabul` timezone, uses localized date labels, never fabricates data. Dashboard initial Overview remains focused on current teams while Career Statistics provides the full historical record.

**3.3 Verified achievements:** player-of-match awards only from official recorded flags, milestones (first/10/50/100 appearances and first/25/50/100 goals), and competition championships **only** for an actual player-rostered champion with an official appearance; championship result is taken from the officially completed knockout final, not an organizer's advertised prize or a guessed standings position. No automatically inferred top-scorer, runner-up or goalkeeper tournament awards where authoritative award data is unavailable. The Achievements tab provides a trophy cabinet with award date, competition and team, detail links, team/competition/year filters and an explicit user-triggered share flow only while player profile visibility is PUBLIC.

**3.4 Privacy and reliability:** career endpoint never exposes another user's records, raw lineups, phone numbers or private career preferences; private player profile has sharing disabled with a route to existing Profile Visibility controls. Full Dari/Pashto/English labels, RTL-compatible chips and text, skeleton loading, errors and retry, truthful zero states; no new dependency or database migration.

**3.5 Verification and release readiness:** `pnpm verify:player-dashboard-phase3` included in main `pnpm verify` chain; API-level pure career regression coverage includes historical records, team win/loss sides, Kabul midnight year transition, duplicate match prevention, trusted championships and official milestones. The final three-stage Player Dashboard comprises Overview, My Teams, Competitions, Matches, Schedule, Statistics, Achievements, Bookings and Settings. Full workspace tests/typecheck/build and Expo web export must be green before release.

Limitations: Season means Gregorian Kabul-local year, not a separate league season identifier. Trend shows the latest twelve months with official recorded activity (rather than missing months). Tournament individual awards require a future explicitly verified organizer award ledger. Manual real-world acceptance tests on Android, actual payments and load testing remain release-operations checks, not automatic CI results.

## Team Manager Dashboard — two-level navigation (2026-10-10)
- Reorganized the Team Manager Dashboard into five **main** tabs: **Overall, About Team, Media, Analytics, Settings**. Existing Overview is displayed as Overall; existing Statistics is displayed as Analytics.
- **About Team** displays a second, conditional horizontal navigation row: **Team, Players, Competitions, Matches, Program**. Program routes to the existing Schedule/activities view; competition registration/rosters, match lineups, activities/RSVPs, media, analytics and settings retain their existing logic and APIs.
- Main and sub navigation use icon + localized labels, blue active underlines, accessible selected states, horizontal scrolling and centering of the active tab. Both rows reverse order for Dari and Pashto. Switching away and back to About Team restores the previously selected subtab; internal content switching automatically highlights the appropriate parent.
- Only Team Manager dashboard navigation was modified. Venue Owner and Player dashboards, database structure and role permissions are unchanged. Regression check: `pnpm verify:team-manager-navigation` is included in full `pnpm verify`.

## Team Manager navigation + per-team subscriptions (2026-10-10)
- Removed **Team** from **About Team**, leaving **Players / Competitions / Matches / Program**. Moved the complete team foundation/identity form (name, city, logo, profile, privacy, description, founded date, colors, contact) to the beginning of **Settings**, preserving its save API.
- **Business policy:** active TEAM_MANAGER role subscription (300 AFN/month) covers exactly one active managed team. Each additional team requires a **separately paid monthly add-on subscription** before creation; existing manager accounts can still hold multiple licensed teams. No silent payment auto-processing.
- Backend `team_extra_subscriptions` slots track user, optionally assigned team, status, expiry, month price and payment approval. Creation transaction takes a user advisory lock and atomically consumes a paid unassigned slot for a second or subsequent team. Requests `POST /api/v1/teams/manager/slots/request`; capacity `GET /api/v1/teams/manager/capacity`. Admin confirms payment with `POST /api/v1/admin/team-slots/:id/activate` and audits it, with requests reviewed on admin **Subscriptions** page. Renewing an expired team uses same slot; activation never happens from user request alone.
- Read/write checks enforce role and team-specific active subscription for core team manager actions (team service, phase1/2/3 manager write endpoints). Expired paid add-on team becomes **read-only** until renewed; players and public profiles aren't deleted. Team transfer to a user already managing another active team is blocked, avoiding unpaid capacity bypass. Transfer to a new paid manager with no team is allowed.
- Existing additional managed teams receive migration-only temporary entitlements, capped at their original base TEAM_MANAGER expiry, to avoid immediate disruption. On expiry they require individual paid renewal. `pnpm db:migrate` applies `0029_team_extra_subscriptions.sql`; `pnpm verify:team-subscriptions` validates the updated policy.
- Admin approval is currently manual, not payment-gateway verified; the administrator must independently confirm funds before activation. Android end-to-end payment/cancellation acceptance testing is still required.

## Single role-aware Dashboard hamburger entry (2026-10-10)
- Removed the redundant **Player Dashboard** option from the non-admin hamburger. Exactly one **Dashboard** item remains after Home; its route `/dashboard` chooses the existing role-specific screen for the signed-in account. The same menu item serves Player/normal users, Team Managers, Venue Owners and Referees without duplicating navigation entries; Platform Admin retains its separate admin menu.
- Kept the existing standalone `/dashboard/player` route functional for deep links and multi-role account compatibility, but it is no longer a hamburger destination. The default role precedence in `/dashboard` remains Platform Admin, Venue Owner, Team Manager, Player/normal account and Referee; no paid entitlement or role authorization changes.
- Navigation regression checks in `verify:mobile-header-navigation` (`verify:navigation`), `verify:role-dashboard` and `verify:player-dashboard-phase1` now explicitly reject a duplicate Player Dashboard menu item.

## Team Manager ↔ Player WhatsApp team chat link (2026-10-10)
- A Team Manager creates a WhatsApp group **inside WhatsApp**, copies its invitation URL, and adds it in Team Manager Dashboard → Settings → Team WhatsApp group. Futsal cannot create or moderate WhatsApp groups through this feature. Manager may edit, clear or open the saved invitation link; the Overview quick actions include a WhatsApp button when one is configured.
- Strict backend validation accepts only HTTPS `chat.whatsapp.com/<invitation-code>` group links, strips optional tracking query parameters, and persists the link privately on `team_manager_profiles.whatsapp_group_url` (migration `0030_team_whatsapp_groups.sql`). Updates require the existing paid-team manager write entitlement. Unauthenticated public team profiles expressly omit the link.
- Player Dashboard overview and My Teams cards show a WhatsApp-icon link per team only when a link exists. The player overview API retrieves links via fresh ACTIVE memberships and ACTIVE teams, not a public directory or invitation. It supports multiple teams independently, excludes former/nonmembers, and never confers WhatsApp group membership automatically. WhatsApp invitation links can be forwarded externally, so WhatsApp group admins should review joins or reset compromised invitation links.
- Existing authenticated deep-link behavior, dashboards, and navigation remain unchanged. URL opening uses React Native Linking with error UI. Localized English, Dari and Pashto. Validation through `pnpm verify:team-whatsapp` and `apps/api/test/team-whatsapp-url.test.ts`; migration required before API restart. Confirm WhatsApp installed/app-link behavior on an Android device.

## Referee Dashboard — Phase 1: Foundation, authorization, appointments (2026-10-10)
- Five top tabs: Overview, Assignments, Match Center, Statistics, Settings, with context-specific horizontal subtabs, premium blue selected underline and Dari/Pashto RTL order. The referee's five-tab screen is on /dashboard for referee-only accounts; explicit /dashboard/referee lets multirole referees access their role tools. The single hamburger Dashboard entry is preserved.
- Existing venue-owner referee grants remain authoritative and free to the referee. An organizer's scheduling of an authorized venue referee creates a PENDING appointment invitation transactionally. Scheduling the fixture again resets the invitation to pending (including previously declined or accepted offers). Old referee assignments do not grant access to a reassigned match. Organizers can inspect the current referee response via owner/referee-assignments/:competitionId.
- Referees can accept/decline pending invitations and request withdrawal from confirmed fixtures. Accepting checks account/venue authorization, fixture status/future time, weekly availability and date overrides in Asia/Kabul, no overlapping accepted assignments, and no playing/managing either competitor. PostgreSQL advisory lock serializes concurrent acceptance decisions for the same referee. Declines do not rewrite fixtures; organizers must explicitly reassign or reschedule them. Withdrawal requests do not silently cancel the match.
- Personal referee profile persists level, experience, optional biography, weekly availability (day/time) and special-date overrides. Venue permissions are listed with navigation to saved map coordinates. Overview, Calendar, Statistics and History use live assigned-match records only, not manufactured values.
- Multi-role accounts can select which dashboard the single hamburger Dashboard destination opens from Profile; selection is stored per user. Referee access is also derived from actual venue referee grants, so a Venue Owner can authorize an existing normal account without a paid role subscription. A direct `/dashboard/referee` entry remains available.
- Assignments Calendar now supports date-scoped day/week/month views (Asia/Kabul), navigation to adjacent periods and today, and real appointment cards. The competition owner's Fixtures page shows Pending / Confirmed / Declined / Withdrawal Requested and refreshes invitation status when scheduling a match.
- Match Center Live and Reports are **deliberately nonfunctional placeholders** in Phase 1 and clearly labeled as Phase 2; official result entry remains organizer-only. No live goal/event recording, match reports/PDFs, offline synchronization, or verified performance evaluation is claimed in this phase.
- Migration 0031_referee_dashboard introduces durable profiles, assignment responses and future phase 2 report tables. Requires pnpm db:migrate before running API. Verify using pnpm verify:referee-phase1 and pnpm verify (GitHub release-readiness workflow). On-device match workflow still requires verification after migration.


## Referee Dashboard — Phase 2: Officiating and approval (2026-10-10)
- Live Match Center accepts only the currently assigned, accepted and venue-authorized referee. The pre-match checklist, server-authoritative two-period clock (start/pause/resume/next period/finish) and append-only scored events are stored on the private `referee_match_reports` record. The center records goals, yellow/red cards, accumulated fouls, timeouts, substitutions and incidents, with a visible event timeline. Optional registered-player attribution is validated against ACTIVE team memberships; no private rosters are exposed to the public. Per-event UUIDs enable retry handling; report revisions detect stale concurrent modifications. Event corrections require a reason and write audit entries.
- Reports require kickoff, a completed checklist, match finish and a non-tied knockout score. Referee submits for organizer review; no submitted event or scoreboard is automatically an official result. The existing Venue Owner → Competition → Referees interface now loads submitted reports, timelines, summaries and approvals/return-for-correction. Approval calls the **existing competition result engine** with server-derived goal totals and authenticated-player goals/cards, so verified statistics, standings and knockout progression update only after organizer action. Return-to-referee reopens the private report for corrections. The service's review-write status prevents duplicate concurrent approval.
- Match scheduling cannot alter an in-progress or submitted referee report. `0032_referee_match_clock.sql` adds persistent server-authoritative clock state to the `0031` Phase 1 report table. Phase 2 is available in all three app languages and inherits the single role-aware Dashboard menu, five-tab Referee Dashboard structure and existing venue-scoped permissions.
- Deliberately deferred to Phase 3: local offline event queue and reconciliation, PDF report export, referee career graphs, automated referee performance ratings. Match clock assists officials but does not replace an official timekeeper.
- New verification: `pnpm verify:referee-phase2`, Phase 2 unit tests and the existing `pnpm verify` suite. A real Android/venue match dry run is still required.

## Referee Dashboard — Phase 3: Offline recovery, career analytics, PDF exports (2026-10-10)
- **Offline event recovery:** Client uses account+match-scoped AsyncStorage with a durable write-ahead queue of up to 120 UUID-keyed match events, plus last authorized report/roster snapshots. The Referee Dashboard preserves its last authorized overview for offline navigation. When the network/API returns, replay compares event IDs against the authoritative report, avoids duplicates, and only removes a locally staged event after a server acknowledgement. Offline events stay marked as pending in the provisional match timeline/scoreboard. Match clock, kickoff, corrections and report submission are **intentionally blocked** until online and all pending events are synchronized. A changed or revoked assignment does not silently discard or submit queued data. Server validates authenticated referee, active venue authorization, roster membership, match period and permissible offline timestamps. Never confuse unsynced local goals with public official results.
- **Career analytics:** `GET /api/v1/referee/career?period=7d|30d|90d|year|all` returns authenticated referee's APPROVED reports linked to completed official matches. The Statistics tabs now render time-window-filtered verified totals, competition breakdown, match history, on-time report submission rates, event counts and a 12-month chart with zero-activity months in Kabul local time. No fabricated ratings and no public exposure of a referee's private history.
- **PDF:** Approved reports generate paginated A4 PDF files on the API, with original Unicode names and incident text included as an embedded UTF-8 `full-report.txt` attachment. The visible PDF uses a Latin portable font; non-Latin fields are explicitly labeled as available in the attachment, pending an embedded Dari/Pashto font/shaping implementation. Only the original referee or competition owner may mint a cryptographically random, 90-second, one-use PDF ticket; download uses a `no-store` attachment response and cannot be reused. Referee history/Match Center and owner Referees page have download actions.
- **Verification:** `pnpm verify:referee-phase3` integrated into `pnpm verify`; automated career/PDF tests and the 28-case Android/manual checklist at `docs/PHASE-REFEREE-03-TEST-PLAN.md`. The device test matrix still requires real-world execution after code deployment. No new database migration is introduced for Phase 3: it reuses 0031 and 0032.


## Referee mobile dashboard layout refinement — 2026-10-10
- Overview's four appointment-stat cards and Statistics' four-item metric groups now use a 2×2 responsive grid. Taller equal-minimum-height cards with centered labels prevent the cramped multiline wrapping seen on narrow Android displays.
- Assignments → Calendar has evenly sized Day/Week/Month segments, a separate highlighted Kabul-local selected day/week/month period, and Prev/Today/Next controls arranged on their own row. Period headings show calendar dates **without an arbitrary time-of-day**.
- The next match, assignment match cards and referee career history display date and time separately, with a Kabul timezone caption and correct English, Dari, and Pashto labels; timestamps omit Greenwich UTC offsets.
- Source regression checks run with `pnpm verify:referee-phase1` and the main `pnpm verify` suite. Android visual validation remains recommended.
