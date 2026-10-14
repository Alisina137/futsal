## Brand polish — borderless logo and 80% startup logo (October 14, 2026)

- Removed logo-specific framing/background/border from the authentication hero and the hamburger drawer; the app-header emblem displays without rounded clipping. Only the logo image appears, with no logo box shadow.
- Reduced the authentication entry logo from 52 px to 41.6 px and the native splash image width from 160 px to 128 px (both exactly 80%); both retain contain image sizing and existing approved logo artwork.
- Extended scripts/verify-app-branding.mjs / pnpm verify:branding to guard the 80% sizing and absence of logo borders and shadows. No backend/database changes. Native splash configuration changes take effect in a rebuilt native binary; Expo Go's splash may not match standalone app behavior.

## Profile — Email-verified participation and role subscription eligibility (October 14, 2026)

- Profile re-review improved the header, avatar/identity typography, action placement, verified/unverified email status cards, mobile/RTL spacing, and Edit Profile accessibility. Optional phone is not shown as an empty field, verified email appears as a readable identity field.
- **Both paid role cards remain visible to all accounts.** A new user without a verified email sees Venue Owner (1000 AFN/month) and Team Manager (300 AFN/month) subscriptions with locked/disabled actions and a verification CTA. Email verification unlocks those actions after session revalidation. Referee accounts are shown the paid options as disabled because server policy prohibits overlapping referee subscriptions; existing active options remain manageable.
- **Join a Team appears on Profile only for users whose email is verified and who currently have no assigned roles**. It disappears on email-unverified, PLAYER, REFEREE, VENUE_OWNER, TEAM_MANAGER and PLATFORM_ADMIN profiles. The team directory also hides the Send Request action for noneligible users while preserving public team browsing.
- Subscription deep-link screen checks verified-email/role eligibility before accepting payment requests; `AuthService.requestRoleSubscription` already rejects unverified users server-side.
- Team join-request API now **independently rechecks current verified-email and active roles** for every new request, returning `EMAIL_VERIFICATION_REQUIRED` or `TEAM_JOIN_BASIC_ACCOUNT_REQUIRED` as appropriate, even for direct API callers. Pending requests can still be cancelled and team browsing remains available. Identity DTOs include verified-email boolean for API authority.
- Added role matrix regression tests, translation strings in English/Dari/Pashto, `scripts/verify-profile-email-eligibility.mjs` root verification gate, and updated normal-user join invariants. No migration.
- QA: test fresh signup → locked paid cards/hidden join option; verify email → unlocked paid roles and Join a Team; obtain PLAYER role via manager approval → Join a Team vanishes while paid role subscriptions remain; cross-role profiles (owner, manager, player, referee, admin); direct URL subscription and forged join-request API; Android/iOS RTL and low network. Existing user data and subscriptions preserved.

## Notifications Center — Phase 3: Final polish and regression (October 14, 2026)

- Finished English, Dari and Pashto localization for all 14 notification event labels; previously unlocalized team activity/challenge/announcement and platform announcements now show proper translated labels. Structured watched-slot messages use Kabul-local date and AM/PM time. New promotion notifications include a venue name for localization. User-authored announcements retain their authored wording.
- Added Expo Go push-availability guidance within notification settings; Expo Go supports in-app notices but native remote push requires FCM/APNs/EAS setup and an installed native development/release build.
- Notification action and foreground-refresh failures no longer hide already loaded cards; action errors appear inline, while more-action state is accessible.
- Hardened inbox API read/delete to reject PUSH-only events and keep first-read timestamp immutable on repeated reads. Native push taps now use a strict allowlist of known app routes, rejecting external and malformed destinations.
- Added trilingual localization test coverage, native route safety tests, service access/replay checks, `scripts/verify-notifications-phase3.mjs`, and root `pnpm verify:notifications-phase3`; physical Android/iOS and push-provider testing remains a separate release gate. No database migration.
- See `docs/QA-NOTIFICATIONS-PHASE3.md` for per-role matrix, EAS/Expo Go limitations, network and RTL/device acceptance scenarios. The notification tab styling and filters were intentionally preserved.

## Notifications Phase 2 hotfix — inbox error isolation (2026-10-14)

- Fixed a confirmed UI failure path in the Notifications tab: when loading an older page failed, the generic page error hid all previously loaded notification cards. The page now keeps those cards visible and provides a local retry for the failed page.
- Individual notification read actions now reconcile the server unread badge through a lightweight authenticated `/api/v1/notifications/unread-count` endpoint without resetting pagination/scroll, and unread-count fetch failures no longer present a misleading read failure.
- Public top navigation and native push bridge use the same count-only endpoint instead of fetching notifications just to refresh the badge.
- Bulk mark-all and clear-read operations now affect only notifications with an actual IN_APP delivery, matching list and unread-count semantics; push-only records are untouched. Added regression coverage to `apps/api/test/notification.test.ts`.
- No schema migration or new mobile dependency required. The main Release Readiness check and physical-device QA remain the release gates.

## Notifications Phase 2 — Inbox accuracy and reliability (2026-10-14)

- Notification reads bypass the in-memory API cache and refresh the top-navigation badge on app resume; offline reads retain the last confirmed count rather than falsely showing zero.
- Notification list, category totals and unread counts only include deliveries with an IN_APP channel. Push-only notifications stay out of the in-app inbox.
- New optional opaque cursor / nextCursor supports stable created_at/id pagination when incoming events are inserted between pages; existing offset clients remain supported. No database migration required.
- Notification screen reloads when the app returns to foreground, ignores stale async list responses, reloads after mark-read, and uses the continuation cursor for older entries. The existing notification layout, filters, translations, and role controls remain in place.
- Added regression cases for push-only visibility and cursor stability in the notification service tests. Device-level regression (Android/iOS, intermittent network, RTL) is still required before release.

## Notifications Center — Phase 1: native push gateway and actionable event delivery (October 14, 2026)

- Existing notification center styling, six category filters, unread interactions, preferences and localized dates are preserved.
- Added new actionable types **BOOKING_REQUEST**, **TEAM_JOIN_REQUEST**, and **TEAM_JOIN_DECISION**, emitted only **after successful operations**: pending online reservations notify the host owner, team join requests notify the owning manager, decisions notify the requester. These are per-user, idempotent and fail open for completed business writes. Booking opens the actual owner pending calendar, team request opens its manager screen, decision opens the team profile.
- Added English/Dari/Pashto message keys, updated relevant Bookings/Teams category handling, and migration `0042_notification_action_events` (apply before starting updated API).
- Native app now includes SDK 57 `expo-notifications`, authenticates push-token enrollment, handles token changes, safely handles notification taps and unregisters devices on logout. Android Expo Go **does not support remote push**: EAS project ID plus FCM/APNs credentials and a development/production binary are required. No credentials are stored in the repo.
- Added PostgreSQL-backed leased Expo push dispatcher with retry cap/expired-device cleanup; API drains the existing durable push queue, initially on startup and then every 30s. Expo ticket acceptance is not proof of phone delivery; manual device verification remains required.
- Added `apps/api/test/notification-phase1-push.test.ts`, extended team join-request action tests and root `pnpm verify:notifications-phase1` verification. See `docs/QA-NOTIFICATIONS-PHASE1.md` for native setup, manual test cases and known boundaries.
- Next proposed Phase 2: inbox visibility based on delivery preferences, reliable unread reconciliation, refresh-on-resume, stable pagination and deeper direct links. Phase 3: full language/RTL/device regression.

## Competitions redesign — Phase 7: security, regression & release readiness (October 14, 2026)

- Implemented release hardening in the real competition backend/mobile, preserving the Phase 1–6 design and existing APIs. Owner competitions no longer incur one accepted-count query **per competition**; two batched queries return accepted counts and the most recent public image. Directory and discovery fallback excludes posts whose audience visibility is private.
- My Competitions now includes team managers without an ACTIVE team-membership row as well as current ACTIVE members, scoped to ACTIVE teams and published competitions. Public media SQL filters on **both status=PUBLISHED and visibility=PUBLIC**; public match statistics exclude teams not currently accepted.
- Prevented race between a limit reduction and simultaneous team approvals by locking the same competition row in the limit-reduction transaction as the acceptance transaction. A second authoritative count inside the transaction rejects decreases below accepted teams. Existing idempotency and accepted registration rules are kept.
- Failed incremental pagination now leaves previously loaded competition cards visible and offers Retry; race response IDs, RTL card alignment, 720px 2-column breakpoint and 144×144 physical top-left image are preserved.
- Added `apps/api/test/competition-phase7-security.test.ts`, `scripts/verify-competitions-phase7.mjs` to root verify, and real PostgreSQL integration `apps/api/scripts/competition-phase7-db.ts` on throwaway CI DB via the competition QA workflow. No new migration for Phase 7; Phase 6 migration 0041 is still required.
- Release manual steps and limitations: `docs/QA-COMPETITIONS-PHASE7.md`. **Device RTL/Android/iOS verification must be performed by a person**, and cannot be certified solely from CI.

## Competitions redesign — Phase 6: permanent logo & cover branding (October 14, 2026)

- New optional **competition.logoUrl** and **competition.coverImageUrl** persist independently on the `competitions` row. Added `0041_competition_branding.sql` with two nullable columns and a registered Drizzle journal entry; existing competitions remain valid without migrating old published posts.
- Organizers manage branded images in **Owner Competition > Settings > Competition Branding**. Reuses the established gallery/file uploader, 6 MB server limit, image MIME allow-list, in-app local preview, square crop for logo and wide 16:6 crop for cover. Uploads are stored through the venue's existing media-assets system with purpose PROFILE or COVER. Owners explicitly save both references; removing an image and saving clears only that assignment, not older published photos. Errors and save confirmations are localized in EN/Dari/Pashto.
- The PATCH /api/v1/owner/competitions/:competitionId contract permits `logoUrl` and `coverImageUrl` as nullable **uploaded internal asset paths only**. Service verifies venue ownership/active paid write access and confirms every non-null asset's ID+publicToken+venue+owner+purpose in storage; external URLs, foreign-venue references, mismatched purpose and missing assets are rejected. Existing open-registration/competition validation remains in force; no new exposed raw-upload route.
- Public competition detail shows the permanent **cover at the top** and the **logo as the round avatar**, falling back to a genuine published photo or trophy when missing. The existing **144×144 square at the physical top-left** of the discovery card uses logo first, cover second, published-photo third, fallback trophy last; all full-width metadata and text arrangements remain as designed. Organizer competition listing displays actual branding.
- Full owner DTO, list response, server-paginated public discovery, and public detail include persisted branding. Brand values are not inherited on duplicate: cloned drafts start unbranded and unpublished. Public detail remains published-only; draft media is not shown through discovery.
- Added contract/permission/lifecycle service tests, updated Phase 1 legacy source assertions, `scripts/verify-competitions-phase6.mjs` wired into root `pnpm verify`, and preserved Phase 1–5 functionality. Apply database migration **before** starting updated API; deploy API and Expo app together. Verify physical Android/iOS image selection, 16:6 crop, RTL and upload while online before release.

## Competitions redesign — Phase 5: standings, verified statistics & matches (October 14, 2026)

- Preserves the existing five public profile tabs and the competition directory's **144×144 square image physically at top-left**; Phases 1–4 discovery, registration, published Home feed, photo gallery and About content are unchanged.
- **League/group tables:** reused the fixed team name/logo column with horizontally scrollable P/W/D/L/GF/GA/GD/Pts/Last 5 for group play as well as league. Form now uses the requested group/league stage's completed/corrected scores only, never mixed with knockout, postponed or unplayed games. Group tables highlight the configured `qualifiersPerGroup` places as **provisional** qualification positions, not confirmed promotions; no winner is presumed.
- **Knockout:** round selection in actual tournament order (engine's round 1 is final) with official bracket match-detail links and `nextMatchId` progression routes. Results, statuses and winner indicators remain server-driven; unpublished or fictional winners are not shown.
- **Verified player leaderboards:** goals, assists, appearances, clean sheets, yellow/red cards and Player of Match awards, with per-team filters, typed metric selection, stable ordering and zero-value empty states. Database aggregation excludes unfinished/void matches by enforcing `COMPLETED` or `CORRECTED` statuses. Public leaderboard entries are restricted to currently accepted competition teams. Unrecorded figures are never estimated, and no private player contact data is displayed.
- **Matches:** status filters now separate Upcoming, Live, Finished, Postponed and Cancelled. New optional team, stage, round and group filters plus reset are derived from real fixtures and registered teams; existing match-detail deep links are retained. Real Kabul-local weekday/date and 12-hour AM/PM time appear together, with Today marking where applicable; tappable venue and online team navigation preserve offline-team restrictions.
- Added EN/Dari/Pashto text, an independent Phase 5 regression verifier, updated `pnpm verify` pipeline and a group-stage form unit test. **No new database migration or endpoint schema** was required. Physical Expo Go/Android/iOS RTL scrolling, accessibility and fixture data QA are still required for release acceptance.
- Next planned phase: **Phase 6 — Competition identity/media branding** (permanent organizer-managed competition logo and cover), contingent on specification and secure image validation.

## Competitions redesign — Phase 4: public detail profile, Home media & About (October 14, 2026)

- Refined the competition public profile while preserving the five existing tabs (**Home / Matches / Standings / Stats / Teams**) and their RTL-aware centered selection, legacy deep-link compatibility (Results -> Matches > Finished), manager registration deep links, and per-25s live-only Home score refreshing.
- Hero has real **published competition media** as cover (honest trophy fallback), stronger contrast with readable status pill/format label, tappable hosting venue, short competition description, accurate follower count, About and Follow buttons, and a status-aware action to open registration (Teams), active/scheduled fixtures or completed results (Matches). Added an explicit Back to Competitions link.
- Summary area shows real registration fee, localized start/deadline time without UTC offset, accepted/max team progress, clickable Teams / Matches / Live-or-Results metrics; no invented photos, team counts or results. Custom **144x144 square top-left directory card** is unchanged.
- Home keeps the **full official published posts/news feed** and strictly currently-in-progress live scoreboard. Added an informative overview card (description, team capacity, fee and key dates) linking directly to full About and Matches, plus **Updates / Photos** secondary navigation (Updates is default), a real-image-only responsive photo gallery, and a dismissible full-screen photo viewer. Photos don't leak drafts/unpublished media. No new independent social post type or comments were fabricated.
- Matches retains all existing functionality (status filters, scores, group stage/round navigation and match detail deep links) with count badges per filter, visual live/finished separation and clearer navigable match cards. Scores are still controlled by the competition engine.
- The full About page now leads with an at-a-glance overview, key schedule/fee facts, capacity bar and direct fixtures/team routes; existing comprehensive rules, prizes, format-specific settings, champion, venue, and registration details remain intact. Registration CTA only appears while registration is actually open, before deadline, and capacity remains.
- Added EN/Dari/Pashto strings and `pnpm verify:competitions-phase4` source regression to the root `pnpm verify` CI pipeline. No DB or API schema changes; Android/Expo Go visual layout and screen-reader testing should be performed on a device. Future Phase 5 is dedicated to deeper standings, player statistics and match-centric workflows.

## Competitions improvements — Phase 3: private participation and registration (October 14, 2026)

- Authenticated `GET /api/v1/competitions/participation` and `GET /api/v1/competitions/:competitionId/participation` expose **only the caller's own active team memberships or manager-owned teams**. Responses contain own team, registration status (INVITED/APPLIED/PENDING/ACCEPTED/REJECTED/WITHDRAWN), fee status and action eligibility, **not organizer payment references or other teams' private applications**. Published-only scope and team/role checks are enforced by SQL, not client filters. Protected mobile reads bypass offline caching; failures prevent misleading registration actions.
- Competition public detail > Teams now includes private personalized status panels across registration-closed/scheduled stages. Authorized managers can **accept/decline invitations, withdraw eligible registrations**, or submit an application after an explicit confirmation showing team and actual fee. Eligible team selection excludes *all* current non-final registrations (including private INVITED/APPLIED/PENDING that public competition details intentionally hide). Registration is blocked when the competition is full or the server deadline has passed. User-visible API errors preserve capacity/deadline/permission specifics.
- My Competitions now lists actionable **personal registration statuses** for every manager/player with team association, plus **All / Active / Upcoming / History** views paginated and filtered by the server. Accepted team participation and payment status appear alongside each competition card; invitation and withdrawal decisions require confirmation, with fresh server state after mutations.
- Concurrent organizer approvals and manager invitation acceptances now run inside a database transaction that locks the **parent competition row**, re-checks current status/actor/registration and counts accepted teams under the same lock before marking a team ACCEPTED. This prevents two requests from occupying the same last team slot. The API continues to authorize organizers and managers; it also rejects new applications when all accepted slots are taken. No schema migration.
- Preserves Phase 1 photo **square at top-left**, name and venue beside it, metadata below, and Phase 2 server-side search/filter/page navigation. Includes `apps/api/test/competition-phase3-registration.test.ts`, `scripts/verify-competitions-phase3.mjs` wired to `pnpm verify`, and EN/Dari/Pashto wording. On-device Android visual and data-backed concurrent-request tests remain for pre-release QA.

## Competitions improvements — Phase 2: server-side discovery & filtering (October 14, 2026)

- Added validated, paginated competition discovery with GET `/api/v1/competitions/discover` and authenticated `/api/v1/competitions/discover/private` for followed, my-competitions and ongoing-at-my-followed-venues scopes. Query parameters: literal search across competition, hosting venue, city and province; province, dependent city, status, format, free/paid status, optional minimum/maximum AFN amount, optional start-date range, six sort modes, page 1–500 and bounded limit 1–30. User-scoped filters use server-side membership/follow checks and require valid authentication.
- SQL filters and ordering execute before paging; total count and `hasMore` correspond to actual matching competitions. Accepted team totals and follower counts use grouped joins instead of per-result fetches; competition fallback photos are sourced from published posts for **only the current page**. Facets expose real provinces and province-dependent cities with published competitions, never synthetic geography. Strict published/non-draft/non-cancelled scope preserves public privacy. No new database migration.
- Replaced Phase 1 local 12-card truncation/full public download with server pages on every Competitions listing. Main directory keeps Followed → Quick Access → Find → Explore and the **image physically in the top-left square** alongside the name and venue. Followed rail makes a separate bounded request for 11 results, shows 10 and an overflow View All, instead of fetching all competitions. Dedicated Registration Open, Ongoing, Most Followed, My Competitions and Ongoing at Followed Venues routes all use scoped server discovery.
- Main search starts **2 seconds after the last text edit**; suggestions use separate 300ms debounced server lookup. Filter/sort taps search immediately, clear pending timers, and ignore stale in-flight answers. Province selection resets city; number/date range inputs validate before applying. Clear Filters, refresh, retry, total results and Show More are preserved. Live discovery requests bypass the offline GET cache.
- Added EN/Dari/Pashto strings, typed request/response contracts, API filter/security/pagination tests and `pnpm verify:competitions-phase2` to root QA. Phase 3 will improve team-specific registration statuses; Phase 6 will add permanent organizer-controlled competition logo/banner. After pulling, deploy API/mobile together. Full physical Expo Go UI/RTL/locale verification remains recommended; phase 2 relies on the existing date text-input format YYYY-MM-DD and does not claim calendar picker UX.

## Competitions improvement roadmap — Phase 1: directory redesign (October 14, 2026)

- Rebuilt the public Competitions listing as **Followed Competitions → Quick Access → Find Competitions → Explore Competitions**, matching the Teams and Venues navigation hierarchy. Existing public profile, match, standings, competition registration and organizer lifecycle endpoints remain unchanged.
- Implemented the requested **competition-only card geometry**: the competition photo appears as a **144 × 144 square in the top-left**, occupying approximately half the total card height. The competition name and hosting venue are aligned **beside the photo in the top row**. Below that block, status, format, actual accepted/max team count, registration fee and deadline/start date occupy full-width rows. Action buttons span the full bottom row. This intentionally does **not** change Team or Venue cards. Layout becomes two columns only at wider screen widths and maintains English/Dari/Pashto RTL text while retaining the image physically on the left.
- Competitions have **no dedicated logo or cover-image schema yet**. The directory now shows each competition's latest genuinely **PUBLISHED photo post** as a fallback cover, fetched in a batched, competition-scoped SQL query; otherwise the trophy fallback remains. An organizer-uploaded permanent competition logo and cover are planned for Phase 6. No image is fabricated and unpublished media stays private.
- Quick Access links provide Registration Open, Ongoing, Most Followed and My Competitions, preserving the existing Ongoing at Followed Venues destination. My Competitions has a dedicated authenticated GET `/api/v1/competitions/mine` returning only published competitions linked to the requesting user's active team memberships. Other users' and unpublished competitions are not exposed. This initial read-only shortcut will gain richer registration statuses in Phase 3.
- Followed rail keeps ten cards and an overflow link; follow metadata and popularity remain server-sourced. Existing competition search still filters names and available status values (advanced server-side searching, province/city/date/fee facets and true pagination are intentionally deferred to Phase 2). Added search suggestions, sorting shortcuts based on available public data, refresh/retry/clear filters, results count, bounded local Show More and usable empty states.
- Registration actions respect the authenticated manager role in the UI; non-managers see registration information instead of a misleading submission label. Actual registration authorization stays with the API. Scheduled competitions link to fixtures, active competitions to standings and completed competitions to results. The server remains authoritative.
- Added English/Dari/Pashto strings, `apps/api/test/competition-directory-phase1.test.ts`, `scripts/verify-competitions-phase1.mjs` and `pnpm verify:competitions-phase1` in root CI. No new migration. Native Expo Go visual QA is still needed.

## Teams Phase 6 — Integration, Authorization and Release QA (2026-10-13)

- Team invitation lookup now supports normalized email addresses in addition to usernames and legacy phone numbers; account email remains verified at membership acceptance.
- Security: an anonymous PUBLIC team roster excludes members with PRIVATE player profiles without altering the total member count. Authorized active team members and managers retain roster access.
- Security: accepting invitations rejects referee grants, inactive/unclaimed teams and stale invitations that would overwrite an active membership role. Transactional membership decisions preserve team/user locking.
- Mobile: public team details refresh roster, pending join state, follow state and highlights on focus. Stale team responses cannot overwrite a newly selected team.
- Mobile: the multi-team manager dashboard clears other-team drafts, roster, join approvals, invitations and media on switch; async actions are guarded by the selected team. Invitations are refreshed on focus, serialized and stale responses ignored.
- Added cross-module integration tests and `pnpm verify:teams-phase6`, included in root `pnpm verify`. Added `docs/TEAMS-PHASE6-QA.md` with device QA and release gates.
- No new migration. GitHub CI ensures source verification, tests, types and Expo export. Real-device QA remains a separate manual acceptance activity.

## Teams Phase 5 — Media, Matches & Statistics (2026-10-13)

- Public team Media supports posts/photos, server-validated bounded pagination for older public posts (published, public-visible only), individual post/comment navigation, and a refresh action. In-flight older-page responses are invalidated on team switch.
- Public team Matches remain linked to official published competitions; only accepted team registrations are allowed in public fixtures and results. Team-wide statistics now aggregate **all** completed/corrected published accepted matches, not merely the first 100 displayed fixtures.
- Public Statistics adds a Top Players subtab (goals, assists and appearances), using only active, public-visibility player profiles on active memberships in published accepted competition results. Private team identities are never exposed in the leaderboard.
- Team Manager Media adds a photo gallery, proper media-library permissions, upload protection across team switches, editable post draft reset and an explicit delete-confirmation step.
- English, Dari and Pashto localization is maintained. Added server unit tests for leaderboard privacy and a `pnpm verify:teams-phase5` source regression suite.
- No new database migration is needed. Verify with `pnpm verify`, Expo web export, and Android smoke QA.

## Teams Phase 4 — Membership & Invitations (2026-10-13)

- Public join-policy endpoint and invitation-only UI on public team detail and directory.
- Players can cancel pending requests from directory and detail. Request-scoped transactional cancellation serializes with manager review; stale approvals return 409.
- On acceptance, pending invitation and pending join requests are mutually resolved. Player role rules and manager subscription authorization remain enforced.
- Team Manager review controls are shown in both the dashboard and team management; personal invitations allow viewing teams and refresh account roles on acceptance.
- English/Dari/Pashto interface copy, API regression coverage, and `pnpm verify:teams-phase4` added.
- No schema migration for Phase 4. Run `pnpm verify`, Expo web export and Android QA before production.

## Teams improvement roadmap — Phase 3: public team profile and identity (October 13, 2026)
- Added an optional **persisted manager-owned team cover photo**, displayed on public team profiles with the manager-configured primary color as a safe background fallback. Managers upload a real photo from their gallery into the existing authenticated social image pipeline in Team Manager → Settings → Team Identity, preview or remove it, then **Save** to publish. Server validates every submitted media token against the uploading manager's actual ownership, active team authority and license; arbitrary external image URLs and another user's media are rejected. Optional removal uses null. Schema migration `0040_team_profile_cover_image.sql` is required before exposing the new cover feature.
- Public team profile retains the six existing tabs and subnavigation; the default remains **Media / Posts**. Header now shows uploaded cover, real team identity and available description/location instead of a generic permanent banner. Existing Follow/Request to Join/Manage/Share actions, member-only links and privacy gates are preserved.
- Responsive Squad cards support two columns on wide screens and one column on phones with player roles and shirt numbers. Real Matches fixtures now distinguish upcoming/live/postponed/final status, scores only for completed/corrected records, localized Kabul date with AM/PM clock and competition deep links. Competitions have compact status cards and authentic dates. Statistics show existing server-computed verified W/D/L, goal difference, win rate and genuine last-five form with a proportionate win-rate bar. Empty data never masquerades as recorded results.
- Added translated English/Dari/Pashto cover controls and `verify:teams-phase3` to full CI. Existing per-team paid-entitlement checks and player identity privacy remain unchanged. Real-device photo-picker and production DB migration smoke tests remain necessary. Phase 4 is reserved for membership and invitation improvements.

## Teams improvement roadmap — Phase 2: server-backed discovery (October 12, 2026)
- Added `GET /api/v1/teams/discover` (authenticated) with Zod-bounded, server-side filters for team name/city/province/district, server-truth result total, deterministic sorting (Recommended, Most Followed, Most Members, Newest, Alphabetical), scopes (All, Most Followed, Following, My Teams), and page/limit pagination (maximum 40 results/request, page maximum 500). Existing `GET /teams` preserved for compatibility; no new database migration.
- Team province and district use manager-maintained `team_manager_profiles` fields; missing values are **not invented**. Available province/city/district dropdown options derive from active and claimed directory teams; cities depend on province and districts on province+city. SQL joins aggregate active-member and follower counts and only join the requesting user's active membership, pending join request and follow; no per-result database round trips and no private member identity exposure.
- Reworked all four Teams directory routes to fetch bounded pages; Followed Teams rail fetches the requesting user's first 11 followed teams separately instead of downloading the entire platform directory. Most Followed now uses server follower totals. Main directory search waits **2 seconds from the latest keystroke**; suggestions are backed by a separately debounced (300 ms) server search; province/city/district selections, sort chips, manual Search and suggested teams apply immediately. Stale request responses are ignored on new criteria, refresh and screen changes. Show More loads the next page without resetting filters or the chosen sort.
- Added English/Dari/Pashto translations, API tests for geographic filtering, literal search, pagination, sorting, authenticated user scopes and invalid input; `verify:teams-phase2` runs in release verification. One team still requires its own paid team entitlement. Public anonymous team browsing and broader public team-profile redesign remain in subsequent phases. Physical mobile UX and full production DB performance should be smoke-tested after deploy; existing migrations unchanged.

## Teams improvement roadmap — Phase 1: directory redesign (October 12, 2026)
- Redesigned the main Teams discovery into **Followed Teams → Quick Access → Search & City Filter → Explore Teams**, matching the visual rhythm of the completed Venues page. Followed carousel retains the ten-team limit and Show More route, now showing member count; a View All shortcut also opens the complete followed list. The three quick actions are Most Followed, My Teams, and Invitations; manager-only Create Team remains secondary and continues to require paid per-team capacity on the server.
- Reused existing 25% logo / 75% information team cards and added a responsive **single-column phone / two-column larger screen** wrapping layout, consistent min-height touch actions, member counts with icons, status chips for joined/pending/invitation-only, localized result totals, refresh, loading/error/empty state, and Clear Filters.
- **Membership UI correctness:** team directory DTO now includes `allowJoinRequests`, sourced from the real manager-controlled team policy. Users see Invitation Only instead of an actionable Request to Join when requests are disabled. Status precedence is Joined → Pending → Invitation Only → Request to Join. Backend authentication, join request deduplication, player-role assignment, manager permissions, and per-team billing safeguards are unchanged.
- Added English, Dari, Pashto strings, API tests for invitation-only/manager/pending statuses, and `verify:teams-phase1` in the full CI chain. No database migration. Existing search-by-name/city submission remains unchanged in Phase 1; **automatic two-second search, server-side filtering, province/district and pagination are Phase 2**. Public anonymous browsing is also deferred rather than presented as implemented.

## Venues discovery — Phase 4: integrated Map/List and red cancelled reservations (October 12, 2026)
- Added a **List | Map** toggle inside the existing Venues results section. It uses the exact same active date, venue/location query, province, available-only, time window and AFN price search results, including live available-slot counts and next-three AM/PM price previews. Switching views preserves the selected filters and selected date. Map pins use only valid saved venue coordinates; map selection opens the same reusable venue card and Reserve Online/Details actions, plus external Google Maps directions to that specific venue.
- Reused native WebView and browser iframe Leaflet maps, preserving the separate Nearby screen's existing **ten-nearest** logic. The integrated directory can show up to **25** real matching pins (with a clear notice when additional results are in the List). The map reports missing venue coordinates rather than generating a fake location and shows a List fallback when map tiles cannot load.
- Main-directory GPS is **opt in**, requested only when the user selects Use My Location in map mode. Android permissions and web location are handled in the foreground, with a strict **10-second deadline including permissions**. If real GPS fails, valid user-profile saved latitude/longitude is used and clearly identified as a default, never as live GPS. Selecting live location searches **Nearest across all provinces**, preserving currently selected date, time, price and availability criteria. Without either live or saved user location the map still shows real venues but does not falsely mark its center as the user's location. Users can open Account Settings to set location when permissions fail.
- Redesigned the **CANCELLED** cards in My Reservations: red/pink card background and border, red state accent/icon/label, pink reservation details. Existing pending amber, upcoming blue and completed green cards remain unchanged. The Cancel Booking action is now destructive red, and the confirmation modal also has a red danger theme and policy panel. Cancellation still requires explicit confirmation; no booking logic changed.
- Added English/Dari/Pashto map labels and `verify:venues-phase4` to root CI. No API contract or DB changes; Phase 5 migration 0039 remains required if previously unapplied. Native Android/iOS visual and GPS permission/device checks are recommended.

## Venues discovery — Phase 6: integration QA and privacy/alert fixes (October 12, 2026)
- Reviewed the actual Phase 1–3 and Phase 5 backend/mobile implementations together (search → live slots → confirmation → completed booking → rating; owner/player cancellation → watched slot → notification), and added Phase 6 backend integration/regression coverage to the existing full verification workflow. Existing feature tests also cover booking idempotency, double-booking races, slot price filtering, localized AM/PM, auth, RTL and error handling.
- **Privacy fix:** public verified review responses no longer disclose private booking UUIDs. A separate authenticated, user-scoped `GET /api/v1/bookings/reviews/mine?venueId=…` returns only the requesting account's reviewed booking IDs. The mobile Reviews form uses that private complete list instead of the **last 30 public review cards**, so older reviewers don't see an invalid second-review action. Server and database still enforce one review per booking.
- **Alert integrity fix:** the public timetable's `UNAVAILABLE` status can mean an owner block, competition occupancy or overlapping reservation. Previously those looked eligible to subscribe for a booking-cancellation alert that would never be delivered. The watch API now requires a **real active PENDING or CONFIRMED booking** with the exact matching venue/court/start/end; users cannot subscribe to blocked-only or unrelated occupied slots. Watch ownership and cancellation availability rechecks remain enforced.
- New regression checks verify private/public separation, review eligibility, watch matching, authenticated access and migration consistency. No new schema migration; **Phase 5's migration 0039 is still necessary if not yet applied**. Phase 4's inline map/list mode was skipped by user phase selection and is **not** being represented as completed. Real-device UI/manual production database smoke checks are still necessary after local pull/deployment.

## Venues discovery — search automatically on typing pause and filter taps (October 12, 2026)
- The **venue name/location** input now waits exactly **2,000 ms after the most recent text edit** before running the same live availability-aware venue search as the existing Search Venues button. Further keystrokes reset this timer. The search can be empty when the user clears their query, returning the directory to the currently selected province/date/filters.
- **Today, Tomorrow, custom-calendar date, Any Time, Morning, Afternoon, Evening, custom time-range, Available Only and ordering** controls apply search immediately on selection, with no Search Venues click required. Price numeric fields instead use a short **500 ms debounce** to avoid a backend request on every digit. Province and search suggestion taps and keyboard Submit continue to search immediately.
- One search timer policy cancels pending search requests when a newer immediate action arrives; stale in-flight responses are ignored by the existing generation guard. The existing Search Venues button remains available as a manual fallback. Suggestions retain their independent short debounce; no new network API or database migration is required.
- Added `verify:venues-live-search` to the CI verification chain to protect delay lengths, immediate filter/search wiring, timer cleanup, query race guards and province/suggestion behavior.

## Venues discovery — Phase 5: verified reviews, saved times and reopening alerts (October 12, 2026)
- Added a non-breaking **About → Reviews** tab with aggregate score, publicly visible verified-only reviews, and authenticated one-review-per-booking form. The server accepts a rating only for the logged-in player's own **CONFIRMED, ONLINE booking whose end is in the past**. The database enforces one review per booking, inputs are validated (1–5 stars / 500 characters), and the public response intentionally excludes author names/phones and reviewer account IDs. Completed reservation cards offer a "Rate this venue" shortcut directly into the relevant review form.
- Added **About → My preferred time** for a saved 12-hour display start time per user/venue. Persistent server storage uses HH:mm local clock semantics, with Save/Clear. Selecting a timetable slot can also save its local start as the user's favorite; showing a preference does not reserve a slot or override the server's real availability.
- On occupied, future timetable slots, authenticated users can opt into **one-shot slot reopening alerts**, or revoke them. Watch creation validates an actual currently occupied slot (matching specific venue/court/UTC start) and rejects the user's own bookings and non-occupied slots. After a player or venue owner cancels a booking, the server rechecks actual available inventory and only then publishes notifications for watchers of the exact slot, with deduplication and a deep link to the venue's date/time view. Notification preference settings remain respected; no private booking identity is exposed.
- Created schema and migration `0039_venue_reviews_times_alerts.sql` and registered it in the Drizzle journal. Added authenticated write/read endpoints under `/api/v1/bookings`, read-only venue review API under `/api/v1/venues/:id/reviews`, and notification type `SLOT_AVAILABLE`. Every new UI string is available in English, Dari and Pashto, and the default verification chain now includes `verify:venues-phase5`. Tests cover access control, duplicate reviews, per-user saved times, real occupied-slot watches, and alerts on cancellation.
- **Deployment:** Run the existing Drizzle migrations **before** deploying the new API, then update/restart the API and mobile/web client. API and database schema must be upgraded together. Phase 4's integrated map/list discovery remains independent and was not implemented here. Slot reopening detection currently occurs on application booking cancellation paths; external timetable edits, block removals and other occupancy changes do not automatically fire a watch, and a watch is only a notification, never a reservation guarantee.

## Venues discovery — Phase 3: inline live slots and reservation shortcuts (October 12, 2026)
- The authenticated/public Venues directory now shows **up to three real, chronological available times per card**, drawn from the same selected date, time window and AFN price filters as Phase 2's availability count. The API returns exact court/area, start/end timestamp, live adjusted price, and promotion identity through `venueDirectoryResultSchema.nextSlots`. Booked, blocked, past, notice-restricted and nonmatching slots never appear. A venue without matching bookable slots receives a clear empty state; each card still has separate Venue Details and Reserve Online buttons.
- Each preview chip shows **12-hour AM/PM in the venue's timezone** and its actual AFN price. A tap verifies the exact venue/area/start/end against a fresh `GET /venues/{id}/availability?date=` network request, bypassing the client GET cache. If taken, stale or offline, no reservation is submitted; an inline localized message and Refresh action appear. Guard duplicate taps and discard stale asynchronous responses when a search result changes or component unmounts. If confirmed available, navigate to the existing detailed **booking confirmation** screen using the fresh price; only the explicit authenticated confirmation action creates the booking, with the backend's atomic final occupancy and price validation unchanged.
- "See all slots" and Reserve Online from search results open **Venue Details → Reserve → Available Slots**, selecting the requested search date rather than resetting to today. Timetable open-date handling is bounded to the venue's published bookable horizon; existing ordinary venue/followed-card deep links still work without a selected date.
- Added English/Dari/Pashto translations for previews, verification and empty states. Added `verify:venues-phase3` to the default release verification chain and API tests for matching price/time slots, promotions, no mutations from searches, and bookings removing outdated previews. **No DB schema migration**; API and mobile clients must be upgraded together before use.
- Follow-up phases: integrated map/list discovery, location-aware results, and optional verified reviews/slot reopening alerts. Production mobile UI/device QA is still recommended.

## Venues discovery — Phase 2: advanced filters and ordering (October 12, 2026)
- Added a progressive filter interface to the existing Venues discovery section: Today, Tomorrow and a selectable 60-day custom calendar (Kabul local date); Any/Morning/Afternoon/Evening/Custom time selection, displaying AM/PM while keeping HH:mm API values; Available Only, validated minimum/maximum AFN prices, and Recommended/Nearest/Lowest Price/Most Followed/Available Soonest sorting. All strings supplied in English, Dari and Pashto; RTL, touch targets and filter state preserved across returns.
- Added validated and separately rate-limited GET `/api/v1/venues/search`. The server computes **actual reservable slots for the selected date** via the existing timetable engine and occupancy/promotion/booking-notice checks. Slot start times are filtered in each venue's IANA timezone. Price range and Available Only never rely on static listing prices; search does not reveal booked-user or private venue details. Per-venue reads are done in batches of five; a DB failure returns an error instead of falsely claiming no slots.
- Search results return real matching available-slot counts, lowest actual slot price, earliest matching time, follower aggregate, and optional saved-profile-location distance (no background GPS permission requests). Dynamic search bypasses the mobile cache; stale responses cannot overwrite newer searches. Sorting is deterministic, and venues without GPS coordinates sort last for Nearest. Show More, province suggestions, details and booking deep links remain unchanged.
- Introduced `verify:venues-phase2` and API integration coverage for availability, closed/paused/suspended venues, price, time, follower and distance order, invalid and past dates. No database migration; **API redeployment is required** to use this new search endpoint. Future phases: clickable exact slot previews, integrated map/list toggle, and venue reviews/alerts. Run the CI verification suite and native device QA before production release.

## Venues discovery — Phase 1: directory layout and navigation (October 12, 2026)
- Reorganized the normal-user Venues screen as **Followed Venues → searchable discovery panel → one responsive results section**. The existing 10-item followed carousel, overflow-only Show More, live province options, debounced name/location suggestions, and Popular/Nearby destinations remain accessible. The redundant large page title/subtitle remain removed, and we did not introduce a third navigation tab strip.
- Results now have a clear localized heading, actual returned venue count, explicit refresh/retry, and an empty-state Reset Search action. In wide layouts (>=670px viewport), the main directory uses two columns; the shared card still reserves 25% for media and 75% for venue information. Venue cards show an honest online-booking status, rather than guessed available slots or prices, and maintain independent Details and Reserve buttons. Reservation deep links still enter **Venue Details → Reserve → Available Slots**, not direct booking.
- Prevents slower overlapping searches from replacing more recent searches, refetches the last applied query/province when navigating back from details without resetting screen state, and keeps results/loading/error messages aligned with the most recent request. Added localized copy in English/Dari/Pashto, new `verify:venues-phase1` in `pnpm verify`. UI-only changes: no database migration or API contract change; later phases cover advanced date/time/price filters, server-side availability snapshots, inline map mode, sorting and deeper features. Native device visual/font scaling validation remains recommended.

## Owner online reservation approval requests (October 12, 2026)
- Online bookings in APPROVAL mode were saved as PENDING, but owners only saw controls inside the time-slot modal for the currently viewed date. Cached timetable reads and mount-only refresh obscured requests sent by other users. Added an owner-authenticated venue-scoped GET /api/v1/owner/bookings/pending, returning all still-pending online reservations irrespective of the viewed week/date, including overdue items that need rejection. Reused existing approve/reject paths, notifications and transaction-safe booking status changes. No schema migration.
- Venue Owner Dashboard now displays a pending booking summary and link to manage requests; Venue Time Table > Time Table displays a complete approvals inbox with booked user, date/weekday, AM/PM time, price, notes and Approve/Reject buttons with review confirmations. Entries disappear only once updated, and calendars are reloaded after decisions. Pending online slot tiles are amber with hourglass rather than the existing confirmed red/checkmark. Expired requests can be rejected but cannot be approved.
- Excluded owner calendar and inbox from the in-memory GET cache; reloads on focus, polls pending requests every 20 seconds only while in foreground and cleans up timers. Added English/Dari/Pashto translations, authenticated/tenant-scoped approval inbox integration tests, and verify:owner-requests source regression. API redeployment required; native app/full test suite pending.

## Supplied futsal court photo applied to Sign In and Sign Up (October 12, 2026)
- Replaced the dark geometric AuthHero banner with the **user-provided blue futsal court photograph** (bundled locally under `apps/mobile/assets/auth-futsal-court.jpg`), shared by both Sign In and Sign Up. `ImageBackground` covers the banner with a translucent dark overlay solely for readable headings, app branding and chips; the court photograph remains visibly recognizable and works offline.
- No authentication or validation logic changed, including the new 3-second signup-success popup. Added `verify:auth-court` regression confirming local image presence and use on both routes. Mobile visual tests and accessibility/font scaling remain to be checked.

## Sign Up completion: gentle 3-second confirmation (October 12, 2026)
- After the server confirms a **successful registration**, the Sign Up screen now shows a centered, accessible success popup with a green checkmark, clear success text and a small Sign In transition indicator. It fades in gently (~280ms), remains visible within a 3,000ms success interval, fades out over the final 350ms, then navigates to the Sign In screen. Keyboard is dismissed before presenting the popup. No popup is shown on failed/duplicate registrations; existing validation and error handling remain unchanged.
- Prevents duplicate registration requests and back/manual Sign In actions while success is displayed, and cleans up navigation/fade timers and native animation when the screen unmounts. The session is not auto-signed-in, preserving current signup/sign-in separation. Localized English/Dari/Pashto strings; responsive dimensions for small devices and RTL indicator alignment.
- Added `verify:signup-success-popup` static regression checks to the default verify pipeline. Android/iOS visual validation and full pnpm typecheck/tests pending. No API/database change.

## Normal User Roles & participation — Join a Team shortcut (October 12, 2026)
- In Profile → Roles & participation, accounts without any assigned role now see a clear, localized **Join a team** card directly after the paid Team Owner subscription option. The explanation states that joining a team is free, and a manager's acceptance grants Player access; no Player dashboard is granted just by opening the shortcut. The action opens the existing /teams directory (search, explore team details, Request to Join, pending-state handling). When an email is unverified, an inline warning explains that email verification is required before requesting membership.
- This shortcut is hidden as soon as the account has another role, such as PLAYER, REFEREE, VENUE_OWNER, TEAM_MANAGER or PLATFORM_ADMIN. English/Dari/Pashto strings, RTL alignment and compact mobile card styling included. Added verify:normal-role-join-team script to the root verification chain. No backend/database modifications.

## Normal User → Player role from accepted team membership (October 12, 2026)
- Fixed root cause: team-manager acceptance of a join request (or a user accepting a team invitation) correctly created an ACTIVE team_memberships row but did not add a PLAYER entry to user_roles. After the recent removal of the unconditional Player Dashboard option for base normal accounts, accepted members such as shams continued to display Normal User and had no role dashboard.
- In authenticated role hydration, PLAYER is now derived from at least one **ACTIVE** `team_memberships` entry as `PLAYER` or `CAPTAIN`, belonging to an ACTIVE and claimed/non-offline team. This retroactively handles previously accepted memberships without changing tables, making manual grants or backfill unnecessary. Pending/rejected applications, inactive teams, and manager-only memberships do not grant Player. When the last active player membership goes away, the derived role disappears at the next account refresh; existing explicitly assigned PLAYER roles remain independent.
- Retained Referee and Platform Admin exclusivity and paid management roles, with no automatic paid privileges. The already-present 10-second AuthProvider account check identifies changes from `/me`, renews the JWT through refresh and updates header Dashboard, Profile → Role, Quick Access and Player feature gating. Visiting Profile proactively invokes the latest `revalidate()` on focus, without repeated fetch loops when the refreshed session changes.
- Added unit tests for normal/accepted/removed roles, paid roles, referee/admin exclusions; new deterministic `verify:team-player-role` regression wired into pnpm verify. Backend/live DB/device tests pending; no migration. Existing Shams account must already have an active, accepted roster membership for the auto-role behavior to apply.

## Normal User — structured and secure username/password change (October 12, 2026)
- Profile → Security → Update username or password now has three clear steps (Choose → Verify email → Update details). A user can select Username only, Password only or Both; verified email is displayed, the existing six-digit code and short-lived verified reset token are required, and password quality rules, field-level errors, a 60-second code-resend delay and a review confirmation are supplied. Never displays raw password in confirmation or saves it in persistent state. Warns before forced sign-out; localized in English/Dari/Pashto, including Kabul-local 12-hour AM/PM cooldown dates.
- The existing email-verification-protected credential reset API now supports independent username or password change without forcing both inputs, while remaining backwards compatible with the standard full password reset. No-op changes, weak passwords and mismatching confirmations are blocked by server validation. Unchanged username/password hash is preserved. Existing reset code expiry, verified token, 72-hour cooldown, transaction that consumes the challenge and revokes all sessions, and unique username enforcement continue unchanged. No migration.
- Added API integration cases for username-only and password-only including unchanged/invalid requests and session revocation, plus `verify:credentials` in `pnpm verify`. Native and full TypeScript/API test run still required before shipping to production.

## Normal User — Profile Quick Access and venue Feed layout (October 12, 2026)
- Profile > Quick Access no longer offers **Player Profile** to basic users, e.g. shams, who do not hold the `PLAYER` role. An actual Player account retains the action; it is also hidden if the user is an exclusive venue-appointed referee. Public Teams and all other Quick Access actions remain accessible. No changes to account roles or database.
- Rebuilt the previously minimally styled **Feed** destination (/feed), which displays real venue news and discount promotions (distinct from the mixed social Home timeline): consistent venue identity/time header, clear update/offer labels, actual post media via `resolveMediaImageUrl`, post type badges, readable body copy, formatted relative published times, and open-update/Comment actions. Discounts show real original/current AFN price, savings, date/AM-PM time and direct venue/slot links. No fabricated content or paid actions.
- Added a fixed-height accessible All/Following segmented filter, dynamic offer/update counts, notification shortcut, responsive two-column/wrapping card actions, localized English/Dari/Pashto labels and RTL support. Filters and navigation refetch on focus, with stale in-flight responses ignored; error/retry, native pull-to-refresh, empty states and venue discovery retained. Removed the large cluster of plain buttons previously shown above the feed.
- New `verify:normal-profile-feed` static UI regression, wired into `pnpm verify`. Full native accessibility/font scaling and TypeScript/runtime checks still recommended before production release.

## Normal User Profile and dashboard role gating (October 12, 2026)
- The main Profile screen (/settings) no longer displays the redundant "Profile" title and subtitle above the account summary. Its section headings remain for clarity.
- Previously `availableDashboardRoles([])` always included PLAYER, so demo user `shams` (base Normal User) saw "Player Dashboard" in Profile → Dashboard Role, even though no PLAYER role was assigned. The entire Dashboard Role section is now omitted for accounts without a genuine role. The hamburger Dashboard destination is also hidden for those accounts.
- Only assigned `PLAYER` users see Player Dashboard, `TEAM_MANAGER` users see Team Manager, `VENUE_OWNER` users see Venue Owner, and `REFEREE` users see Referee exclusively. Admin uses its existing independent Admin navigation; no self-assigned new roles. Cached dashboard preference and the legacy direct /dashboard/player URL cannot bypass eligibility, with base normal accounts redirected to Home when entering /dashboard. All normal-user bookings/team-directory/social features remain untouched.
- Updated role, referee and hamburger checks and added `verify:normal-profile-roles` to `pnpm verify`. No database/schema changes; native device/runtime checks still recommended.

## Owner weekly timetable empty-looking cells and compact clock labels (October 12, 2026)
- The weekly grid builds start-time rows from all weekdays, so days with different opening periods, exceptions or slot lengths naturally contained blank cells. These now render an explicit subdued, non-bookable state: Closed on a closed day, Ongoing when an earlier event spans the row, and No slot for a genuinely unscheduled interval. Tapping a placeholder opens that day's timetable instead of creating fake reservations. Existing slots and owner actions are unchanged.
- Narrowed the sticky owner Week time rail from 94px to 72px and aligned its header/cells. The Day view clock header and cells now both use 72px (previously 78px/94px), with the time displayed as 08:00 above AM or PM. No timezone suffix; respects RTL/LTR and keeps full formatted accessibility labels.
- Localized new status labels in English, Dari and Pashto; updated timetable and pinned-column verification. Extracted a cached Kabul clock formatter and a pure missing-cell classifier to avoid rebuilding costly Intl formatters on every slot render, with runnable examples added to verify:owner-week-grid and wired into pnpm verify. No backend or database changes. Android RTL/LTR visual validation and font scaling are still recommended.

## Player Dashboard Overview and More navigation (October 12, 2026)
- Redesigned the first player Overview tab: profile/team hero with real player image/position/role, quick Edit Profile and My Teams actions, optional WhatsApp link, mobile-friendly 2-column real match/goal/assist/award statistics, highlighted next-match matchup and details, outstanding team invitations and activity responses, upcoming activities, and recent official match performance. Existing data, user actions and empty states preserved; no invented data.
- Main player navigation now: Overview, My Teams, Competitions, Matches, Bookings, **More**, Settings. Moved former main Program/Schedule, Statistics and Achievements (Eftekharat) inside More as three subtabs (Schedule, Statistics, Achievements). More is immediately before Settings; entry focuses Schedule by default; existing components remain functional, and localized Dari/Pashto/English labels are provided. The More subnav uses a full-width segmented selector with shared-width responsive tabs, an explicit blue selected state, keyboard/accessibility semantics, RTL order and focus-to-visible horizontal scrolling.
- Preserved the outer player dashboard scroll position on tab changes using a viewport-height content guard; updated Phase 1, Phase 3 and active-navigation checks, added verify:player-overview-more. No backend/schema changes. Native visual and full TS verification remain recommended.

## Prevent false server-disconnected banners during rapid tab navigation (October 12, 2026)
- Root cause: the global NetworkProvider polled `/health` every 3 seconds with a 2.5-second timeout and treated three failures as a confirmed outage, even when bursts of screen API fetches temporarily delayed the health response. The banner would then announce a spurious server outage and recovery while internet and backend were in fact available.
- Introduced a pure reachability confirmation policy requiring at least three consecutive unsuccessful health probes **spanning 12 seconds**, using a 6-second probe cadence and a 5-second deadline. One-off slow connections, rapid tab transitions, and tunnel contention do not flash the global outage banner. Real sustained API outages still show after confirmation and require two successes to announce recovery. Independent API request errors remain visible on the affected screen rather than masquerading as global disconnections.
- Kept one health request in flight at a time; background timer probes are skipped; stale responses from before NetInfo connectivity transitions are ignored through a probe epoch. NetInfo still independently reports genuine device/internet disconnection. Existing account-suspension and private-endpoint protections are untouched.
- Added executable deterministic state-machine checks (rapid bursts, startup, sustained outage, recovery, duplicate banners) in `verify:api-reachability`; wired into `pnpm verify` and updated the legacy phase-3 regression. No API schema/database changes. Verify on a real Android device with rapid navigation and a genuinely disconnected server.

## Player Dashboard — My Teams mobile selector and team cards (October 12, 2026)
- Fixed the player My Teams navigation controls turning into very tall, thin ovals on Android: the shared Choice horizontal ScrollView now explicitly disables flex growth/shrink, keeps a 56px-tall segmented selector, centers 46px minimum-height buttons and displays single-line localized labels. Uses an auto-focused selected tab with correct RTL order and horizontal overflow for long Dari/Pashto translations; the same component is used for player preference filters.
- Redesigned **My Teams** as compact, clearly grouped team cards with a consistent 70px crest, stronger name/location hierarchy, member role and explicit default-team badges, subtle divider, equal-width responsive action buttons for View Team and Team Activities, an optional Set Default action, WhatsApp link, and a subdued Leave Team footer with the preexisting confirmation/authorization checks. Long text and narrow screens cause the buttons to wrap rather than stretch or overflow. RTL/LTR layouts supported.
- Applied the card hierarchy and responsive equal-width action row to Find Team results as well; invitation and membership request flows are unchanged.
- Added static UI guard checks to player dashboard phase-1 verification. Full on-device Android/iOS visual, accessibility font scaling, and runtime/typecheck verification are recommended before production deployment. No backend or database changes.

## Tab selection preserves page scroll position (October 12, 2026)
- Root cause: Venue Details and Team Details main-tab handlers called the outer page ScrollView.scrollTo({y:0}). The competition profile's tab switch similarly scrolled the outer page up to the tab bar. This appeared like an unexpected page refresh whenever a tab was selected.
- Removed **only** these programmatic vertical scrolls from ordinary main-tab changes on venue, team and competition detail screens. Kept horizontal selected-tab scrolling and the first-subtab default. Tapping an already-active tab does not force a new content transition.
- Wrapped dynamic main/sub-tab content in a window-height minimum region so native scrolling does not clamp back toward the top when the next tab has very little or no content. Uses device viewport height, allowing normal manual scrolling while preventing unwanted jumps between tabs.
- Intentional navigation to other screens and explicitly requested deep links, such as opening the competition registration form, retain their scrolling behavior. Added regression assertions to verify:navigation-focus; Android/iOS/RTL visual checks are recommended.

## Sticky time column in weekly venue timetables (October 12, 2026)
- Public Venue > Reserve > weekly timetable and venue owner's Calendar > Week now pin their time-of-day column **outside** the horizontal date ScrollView. As the user swipes dates left or right, every row retains the AM/PM time marker in a stationary rail. The time rail appears at the right for Dari/Pashto (RTL) and at the left for English (LTR); only day/date headers and slot cells move horizontally.
- Time header heights and each time-row height are synchronized to the actual measured heights of scrolling date headers/slot rows, protecting alignment with enlarged fonts or multiple bookings at the same time. The seven days share one horizontal scroll position; existing slot actions, 12-hour labels, colors and calendar navigation are unchanged.
- Added verify:sticky-week-times to pnpm verify, and repaired an outdated instant-slot test marker for the current ownBookingsByArea map. No API/database changes. On-device RTL/LTR swipe and accessibility-font scaling review is still recommended.

## Venue and team detail subtabs — full-width styled segmented navigation (October 12, 2026)
- Fixed the main-tab secondary navigation on **venue** and **public team** detail pages. React Native horizontal scroll containers previously sized their content to the intrinsic short tab labels, leaving two or three subtabs bunched at an edge instead of spanning the navigation row. Both subtab content rows now flex-grow to fill the available width; each item shares space evenly, with a 112px minimum width and horizontal scroll for unusually small screens or long translations.
- Replaced plain text/underlined subtab treatment with an inset rounded segmented bar: light neutral backgrounds for unselected options, high-contrast solid-blue selected option with white semibold 14px label, subtle borders, 48px+ touch target and press feedback. English/Dari/Pashto RTL layout retains per-tab measurement and focus-to-visible scrolling, and the first subtab remains selected on first navigation. Updated source checks in verify:navigation-focus and verify:venue-detail.
- Styling-only: no new APIs or database migrations. Verify visually on Android and iOS and with font scaling and RTL on narrow phones.

## Reserve slot grid header and own-booking cancellation (October 12, 2026)
- Reserve > Available Slots weekly grid now shares the same 94px width for its time-column header and time cells and the same 124px width for its weekday headers and slot cells, including RTL layouts.
- Authenticated player booking lookup no longer rejects player-linked MANUAL reservations; it still filters to the exact venue, user and active booking statuses. Matches prefer area + exact start time and fall back to interval overlap on the same court if the published timetable changed after reservation.
- The venue grid requests fresh owned bookings on focus, bypassing the old 15-second cache for /bookings/me. Selecting a future owned slot now exposes the existing cancel confirmation via a prominent danger button. Cancellation remains online-only and enforced by the server; other players' slots, expired bookings, and unlinked manual bookings cannot be cancelled by the viewer. Successful cancellation refreshes the timetable.
- Existing verify:reserve-actions now exercises the same-court ownership matching, manual/online bookings, unrelated owners, cancelled states, slot grid column alignment, live reads and cancel action. Device/RTL visual QA is recommended. No backend schema changes.

# PROJECT STATE

## Navigation selection and focused tab visibility (October 12, 2026)
- Navigation rule: first main tab selected when a navigation first appears; selected tabs use existing highlighted UI and must remain visible within horizontal navs in both RTL and LTR. Explicit booking/deep links remain respected.
- New reusable `useVisibleTab` hook measures viewport width, content width and item layout before centering selected tabs; handles relayout, initial render and selection changes without hard-coded offsets. Used for venue detail and team detail main and sub navigation.
- Switching a venue/team main section resets that section's subnavigation to its **first** tab, then focuses the selected item. Team manager's About Team now always opens at Players, not a previously visited subtab. Other dashboard navigation components already calculate selected item location and maintain their focus.
- The admin panel defaults to its first Overview/Dashboard section on entry rather than an old browser-stored selection. The admin sidebar automatically expands and scrolls to the currently selected group/item. Public top navigation highlights Home when displayed outside its five direct destinations. Owner navigation falls back to its first item for unrecognized owner routes.
- Regression verifier `pnpm verify:navigation-focus` checks layout-based active focus and first-tab defaults. Native Android and web visual checks, especially RTL horizontal scrolling and nested tab layout, are still recommended. No backend/API/database change.


## Global AM/PM date and clock display (October 12, 2026)
- Global user-facing clock convention: always a **two-digit 12-hour time with explicit English `AM`/`PM`**, e.g. `13:00 → 01:00 PM`, `18:30 → 06:30 PM`, `22:00 → 10:00 PM`, `08:00 → 08:00 AM`. No visible seconds, Greenwich `GMT+4:30`, `UTC+04:30` offsets or raw ISO timestamp on supported public and dashboard date/time displays. Dates/day names stay localized (English, Dari, Pashto), time markers use AM/PM even in RTL.
- Updated shared date-time formatters (competitions, referee calendars, notifications, trial/billing, admin), competition match schedules, booking confirmation, compact slot tiles, reservations, venue offers, owner week/day timetable headers, promotional listings, specials/history and booking/venue date display. The 12-hour convention applies to the date-time picker as well.
- Replaced free-form **24h time display** on owner timetable period/special exception, owner manual booking/block-time, and referee availability with a dedicated `TimeOfDayPickerField` that shows AM/PM and returns the same validated 24-hour `HH:mm` value required by the existing backend. DateTimePickerField now shows a 12-hour hour stepper and AM/PM toggle while continuing to send UTC ISO values.
- **Never change internal state semantics:** real database timestamps remain UTC ISO, timetable columns remain `HH:mm`, public/owner grid lookup keys remain 24h, promotion query matching remains 24h, and all validation/comparison logic stays intact. Source-only tests verify the visible convention and representative edge cases (noon/midnight/time zone fallback/RTL); manual Android layout review is still recommended.


## Booking confirmation UI refresh (October 12, 2026)
- Replaced the bare reserve-confirm card that printed a raw UTC ISO timestamp with a compact, RTL-aware booking summary: venue identity, separately labeled **localized date, weekday, 24-hour start/end time**, cross-midnight end date (if needed), clearly marked estimated AFN price, optional notes, and a colored live-price/availability recheck notice. The venue's configured IANA timezone controls display; invalid/missing zones safely fall back to Asia/Kabul. No GMT offsets or seconds are displayed.
- The primary confirm button now keeps a readable white label even during loading (spinner shown alongside it), respects internet availability, and rejects missing/invalid time selection. Back-to-availability action remains available. All six new UI labels are localized for English, Dari, and Pashto.
- Original server-side price/availability revalidation, idempotency key reuse, slot-taken/network error handling, and post-success navigation were preserved. Preview price and end time are **not** sent as authoritative booking data. Note max length matches 500-character backend validation. No API or database changes.
- Added `pnpm verify:booking-confirm` to normal `pnpm verify` to cover Kabul and alternate IANA zones, cross-midnight fixtures, invalid inputs, locale formatting, RTL content markers, and booking safety invariants. Native Android manual visual review remains recommended.


## Competition match schedule and compact typography (October 12, 2026)
- Public Competition > Matches now groups fixtures by **stage + round number** rather than by calendar day. One localized matchweek heading shows "Matchweek N of Total" in the league, and group-stage/knockout rounds are distinct. Date-specific splitting and redundant per-match round labels were removed; all fixtures for each round appear together.
- Every scheduled match displays Kabul-local date **and** 24-hour clock with no seconds/GMT offset; for matches within seven days (past or future) the date label is replaced by the localized weekday. Completed matches also retain their played date/time alongside scores. Unscheduled fixtures remain clearly labeled.
- All shared `AppText` typography variants and the shared text-field input font size are reduced by **1 dp/px** (caption 12→11, body 15→14, bodyLarge 17→16, title 25→24, display 32→31; input 16→15). Existing line heights, accessibility font scaling, minimum tap targets, and text padding remain unchanged.
- Vitest regression coverage: group matches spanning dates, multiple stages using same numeric round, relative seven-day cutoff, and EN/Dari/Pashto 24-hour Kabul formatting. This is UI-only; competitions/matches/database unchanged. Native device screenshot/RTL manual QA remains recommended.


## Persistent mobile API-disconnected banner (October 12, 2026)
- Root cause targeted: mobile's Expo `EXPO_PUBLIC_API_URL` remains on an old ngrok hostname even after `pnpm dev:api` opens a new HTTPS tunnel. Physical devices cannot reach `localhost:4000`; Expo's own tunnel is independent from the backend API.
- `scripts/dev-api.mjs` now validates the public HTTPS tunnel actually returns Futsal's JSON `/health` before safely updating **only** the `EXPO_PUBLIC_API_URL` entry of gitignored `apps/mobile/.env.local`, preserving other config. Disabled via `FUTSAL_SYNC_MOBILE_API_URL=false`. After changing Expo env, restart `pnpm dev:mobile` and reload Expo Go. Failure leaves previous config and prints diagnostics.
- `pnpm dev:check-api` now checks local API `/health`, DB `/ready`, ngrok inspector, configured Expo host and current HTTPS API `/health` without exposing credentials. Mobile reachability probe validates the expected JSON service identity (not just HTTP 200 from ngrok HTML/interstitial or unrelated servers).
- `pnpm verify:dev-api` covers mobile-env URL sync, HTTPS restriction, idempotence and preserving other keys, plus earlier process-supervisor tests. No live Neon DB or device was accessible to ChatGPT, so on-device validation still requires running commands on user's PC.


## QA Abdul REMOVED membership recovery (October 12, 2026)
- User's latest real database seed correctly rolled back because Abdul already has an inactive/non-player team membership on Alisina United, which the earlier QA seed refused to overwrite; zero competitions were created by that failed transaction.
- Fixture seeder now accepts ACTIVE CAPTAIN as a valid player team membership. For an existing `REMOVED` `PLAYER` or `CAPTAIN`, it requires a separate explicit `--restore-abdul-membership` opt-in in addition to `--confirm`; after role and owner/referee guards it converts only Abdul's Alisina-team membership to ACTIVE PLAYER, clears `left_at`, and does not restore captain privileges or change account-level roles, paid subscriptions, or ownership. `ACTIVE MANAGER` and other incompatible cases are refused.
- PostgreSQL integration smoke tests verify the default refusal and complete rollback, opt-in restored membership, three competitions, and rerun idempotence. Run only against development/staging after checking `DATABASE_URL`: `pnpm db:seed:competition-story --confirm --restore-abdul-membership`. No changes to the user's Neon DB occur merely by pulling GitHub.


## Development API and QA competition seed recovery (October 12, 2026)
- `pnpm dev:api` now launches the API first, waits for its `/health` and database-backed `/ready` response, then starts ngrok. Ngrok's interactive terminal UI is piped to prevent it hiding API startup/errors; failures, busy ports, absent ngrok, and API-only mode are displayed explicitly. Local API remains running if a tunnel fails. `pnpm verify:dev-api` exercises the real launcher against simulated healthy/failing API and ngrok commands on CI.
- The first competition-story seed reported `QA story rolled back: Abdul must already be a player on the selected manager's team`. This is a full transaction rollback; migrations were successful and that seed inserted zero competition records. Root cause: seed wrongly required Abdul to already be a Player member of Alisina's team. It now explicitly targets Mahdi's existing subscribed venue and Alisina's managed team; if Abdul is an eligible active Player without an existing inactive/non-player record, it adds only the missing test-team membership. Existing roles/teams are preserved.
- A PostgreSQL-18 disposable CI job applies migrations, exercises the missing-membership seeding flow and reruns the fixture to check idempotence; never uses the user's Neon database. That integration test also exposed a historical error in the manager profile `founded_on` PostgreSQL CHECK regex; additive migration `0038_team_profile_date_constraint.sql` fixes its escaped-digit pattern. Apply `pnpm db:migrate` before retrying the seed.
- No actual database changes are made by pulling code. After pulling, rerun `pnpm db:seed:competition-story --confirm` against the intended development/staging database; never run the role-normalization seed to solve this membership bug.


## QA competition story (October 12, 2026)
- New opt-in `pnpm db:seed:competition-story --confirm` fixture; 15-team/105-fixture League currently in week 4 with 21 completed results, 12-team/4-group Groups-and-Knockout, 16-team Knockout bracket. Included connected stats for Abdul, an eight-person manager-team roster (five starters and three substitutes), 22 no-login suspended athlete fixtures for stat leaderboards, venue-scoped referee match assignments, competition rosters/lineups, in-app notifications, manager profile/activities/announcements/posts and friendly. Details: `docs/QA-COMPETITION-STORY.md`.
- Corrected and confirmed ownership: Mahdi = Venue Owner, Alisina = Team Manager, Abdul = Player. Seeder requires Mahdi's subscribed venue and Alisina's active managed team, and **does not swap ownership or existing roles**.
- No database connection is exposed to ChatGPT; the application database remains unchanged until the seed command runs on the operator's development/staging DB.


## QA test users (October 11, 2026)
- Added an opt-in local 25-account authenticated fixture seeder (`pnpm db:seed:test-accounts seed --confirm`), with 5 each of Normal User, Team Owner, Venue Owner, Referee, and Player. Fixture details and cleanup: `docs/QA-TEST-ACCOUNTS.md`.
- No passwords are stored in Git; seeder requires a separately delivered private, gitignored CSV. Seed marks email verification for QA without sending an actual email; addresses under `@futsal.test` cannot receive mail.
- The seeder creates real test-only active subscriptions, teams, venues with one court each, player memberships and venue-scoped referee grants. User role conflict boundaries and cleanup ownership markers are preserved. No financial receipts are fabricated.
- **Important**: The code/fixtures are versioned; the actual database remains unchanged until the operator runs the seed against their configured development or staging database. Never seed a production database.


## Verified-email identity rollout (October 11, 2026)
- Authentication redesign: username + optional phone + strong password on signup; no account role is assigned. Registration UI returns to Sign In. Password login uses username or **verified** email only; phone is contact data and no longer a login/recovery identifier.
- Profile now offers authenticated email linking/change with current-password verification, 6-digit one-time codes, 10-minute expiry, 5 attempts, 60-second resend delay, and normalized uniqueness. A newly linked email unlocks role requests/assignments; unverified legacy profile emails do **not** count as verified.
- Server enforces email-verification requirements on paid role request/activation, referee appointments, first Player Profile creation and Team join approvals/invitations; preexisting entitlements and member associations are preserved by migration.
- Password recovery is email based with username or verified email identifier, generic pre-verification responses, cooldown and session revocation. Accounts without verified email cannot self-recover a forgotten password.
- Canonical additive migration `0037_verified_email_auth.sql`: optional phone, nullable legacy password-reset phone, verified email timestamp, email-verification challenge ledger; preserves existing users, roles and subscription data. Run `pnpm db:migrate` before deploying the new API.
- Email transport is a server-side HTTPS JSON webhook set through `EMAIL_AUTH_WEBHOOK_URL` (optional bearer token via `EMAIL_AUTH_WEBHOOK_TOKEN`); production must configure the provider, switch `PASSWORD_RESET_DEV_MODE=false`, and use a secure reset signing secret. Local-only debug codes require explicit dev mode.
- Migration intentionally does not trust or auto-verify previously stored profile emails. Existing role entitlements remain accessible; new role grants are gated. Full manual QA with real email webhook and persistent database, mobile RTL and release build is still required.


## Admin panel rollout (October 11, 2026)
- Phases 1 and 2 are implemented on main (modular console; bounded privacy-aware analytics).
- Phase 3 implements server-side user filters, six-tab account details, role provenance/conflict review, audited private notes and session revocation, and atomic account suspensions. Do not auto-edit role conflicts. Run migration 0033 before starting the updated API.
- Platform-admin role grant/revoke UI is postponed until a suitable MFA/step-up and dual-control policy exists; referee, player and paid management roles stay within their owner/team/subscription authority. Staging DB tests and manual browser QA remain deployment gates.

## Admin Phase 4 (October 11, 2026)
- Cross-platform operations console now has Venue, Team, Competition, Referee, Reservation directories, record details, filters, and role/scoped warning reviews.
- Venue verification workflows remain reason-gated, confirmed, and newly **transactional with audit logs**; one venue owner = one venue and only one active court continues to be enforced by the database.
- Investigation cases for Venue/Team/Competition/Referee/Reservation are stored in `admin_cases` (migration 0034) with OPEN → UNDER_REVIEW → RESOLVED transitions and immutable audit trails; business source records are never edited during investigation.
- Existing manual-team claim/paid-subscription and venue-referee eligibility workflows remain authoritative. Staging visual QA and DB integration required before release.

## Admin Phase 5 — Financial operations (October 11, 2026)
- Migration 0035 adds a separate manual-receipt ledger for **future** paid Venue Owner / Team Manager and separately billed extra team-slot subscription activations. No unsupported historical payments are backfilled as cash.
- Existing venue `subscription_payments` retain full past history; new financial APIs read venue, paid-role and team-extra receipts together in server-paged, date-filtered finance reports, clearly scoped as **manually recorded** receipts (not confirmed bank settlements).
- Manual activation uses a mandatory unique payment reference, amount and term snapshot; receipt inserts and entitlement grants share one transaction and a cross-stream reference lock.
- Paid receipt voiding is reason-required, row-locked and audited atomically. Voiding a receipt never silently rewrites entitlements or historical bookings; subscription access needs a separate explicit review.
- Financial console shows 7-day expiry/pending review counts, type/status/ref filters, local Kabul time and English/Dari/Pashto. Team-slot confirmation includes a second explicit review step.
- **Deployment gate:** apply migration 0035 before rolling out the updated API; run `pnpm verify`, test real DB transaction concurrency, compare receipts to actual manual payment proof and manually inspect RTL layouts.

## Admin Phase 6 — Moderation, Reports & Customer Support (October 11, 2026)
- Database migration 0036 creates private user abuse reports, support ticket timeline/status/assignment, scheduled platform announcements with deduplicated audience snapshots, and a non-destructive `social_post_comments.hidden_at`.
- Platform administrators receive paginated Moderation, Reports, Support, Announcements and Notification Delivery Health workspaces. Public authenticated users have their own support ticket and abuse report submission screen. Only the reporter's ticket history is visible to that requester.
- Hidden posts and comments no longer appear in social feed or comments; promotions are closed without rewriting booking history. User warnings are in-app notices and each moderator write is reason-audited.
- Support workflow: OPEN → IN_PROGRESS → WAITING_FOR_USER → RESOLVED → CLOSED, with internal assignment/priority and actor/time-stamped messages. Resolved tickets are inspectable; closed tickets cannot be rewritten.
- Scheduled announcements: audience scoped to all active accounts, a specified user, role or city, with one `ADMIN_ANNOUNCEMENT` notification per user per campaign. Durable recipient snapshot, 150/batch deliveries and a 60-second server poll. All-in-app only; push pipeline has no external send worker yet.
- Delivery administration is read-only status overview plus safe FAILED push requeue (max 3 attempts). Requeue explicitly does not claim successful push delivery.
- Run `pnpm db:migrate` before API start and `pnpm verify`. Staging gates: test moderation hiding, owner isolation, concurrent report filing, workflow transitions, campaign retries, large audiences, notification preferences/push execution, and RTL form usability.

## Admin Phase 7 — Final Governance and Release Controls (October 11, 2026)
- FINAL planned admin rollout stage: sensitive settings writes require **reason (10–500 characters)**, reviewed `expectedUpdatedAt` version and strict validation. The database serializes configuration changes with an advisory lock; stale edits and no-op changes are rejected with HTTP 409. Configuration+audit are committed atomically and audit records contain a safe diff (never template bodies).
- A new admin-only Audit History view supports server-side paging, target/action/user/date filters and date-bounded CSV export (31-day interval, max 1,000 rows, formula-escaped fields, no raw metadata). Legacy audit remains available but redacted. Admin API responses are marked no-store and CSV exports are throttled.
- Operational Readiness provides authenticated checks for presence of required admin tables and counts outstanding reports, support cases, campaigns and failed push deliveries. External push sender, independent backup restoration and staging/security QA remain explicitly **UNKNOWN**; automatic PASS is not a deployment authorization.
- Web/mobile administration provides localized English/Dari/Pashto configuration diff review, conflict-aware refresh, audit/export and readiness dashboard. No arbitrary admin permission granting: MFA, dual-control, restore testing, payment reconciliation and production cutover require a separate approved security plan.
- **No new database migration in Phase 7**, but production must first have all existing migrations through `0036_admin_trust_support`. See `docs/ADMIN-PHASE-07.md` and `docs/OPERATIONS-RUNBOOK.md` for operator release gates.

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


## Venue Details — five-tab redesign (2026-10-11)
- Venue detail route: \`apps/mobile/app/(app)/venues/[venueId].tsx\`. Replaces the vertically stacked posts/about/booking page with a blue premium venue cover/logo header, follow action, Reserve Online CTA, updates/share/location quick actions and five horizontally scrollable main tabs. **Media** opens by default. In Dari/Pashto tabs render in RTL reading order with unmirrored icons.
- Main tabs/subtabs: **Media → Posts / Photos / Videos**, **Reserve → Available Slots / Offers / My Bookings**, **Competitions → Upcoming / In Progress / Completed**, **Updates → Announcements / Alerts**, **About → Overview / Facilities / Location & Rules**. Components: \`apps/mobile/src/components/venues/VenueDetailSections.tsx\`. Each main tab loads only the corresponding real domain data, with loading/empty/error states.
- **Reserve Online deep link:** Existing VenueResultCard and FollowedVenueTile shortcuts pass \`focusAvailability:"1"\`; the detail route responds by selecting **Reserve → Available Slots** (never showing Media and never automatically purchasing a slot). Explicit Venue Details opens Media. The header's Reserve Online CTA selects the same target. Promotion links may choose the intended date/highlighted slot.
- Reserve uses seven-date shortcut rail, Prev/Next controls and bounded ISO date input, real server-provided availability and promotion prices; cached/offline slots are explicitly read-only. My Bookings only shows this authenticated user's bookings at this venue; cancellations use the existing booking API. Availability and slot price are server revalidated by the existing booking confirmation flow. No multi-court selector (one venue = one court).
- Media displays authorized published venue posts, promotion/competition filters, a two-column gallery with full-screen image viewer, and linked external YouTube/Vimeo videos when published in post text. Updates displays real announcements, the actual online-booking-disabled state and a route to global notification settings. Competitions are filtered by exact venue ID and published status from the existing public competition API. About shows existing verified venue identity, rules, court facts and existing latitude/longitude via an interactive preview and Google Maps link.
- Existing public data does **not yet expose** independently configurable facility amenities, uploaded/hosted native videos or per-venue notification preferences. UI explicitly avoids presenting invented values or claiming these backend features exist. Add owner-configured facilities, native video storage and venue-specific notification opt-ins as future backend extensions.
- Verify: \`pnpm verify:venue-detail\` is included in \`pnpm verify\`; existing media, marketing, relative post time and venue card regressions were adapted to the extracted venue components without weakening their checks. No database migration is introduced.


### Public Venue Details — owner-style customer reservation grid (2026-10-11)
- Reserve → Available Slots now mounts `VenueSlotTimetable` instead of the former stacked slot-card list. Default view is **Week**, with Day/Week/Month selection, Today/Previous/Next navigation, horizontally scrolling day/time matrix, color legend, and individual time+AFN price tiles styled after the venue owner timetable. Day offers a two-column set of time tiles; Month is a date picker that opens the tapped Day's timetable.
- The **existing** GET /api/v1/venues/:venueId/availability response now includes an optional `timeline` of every configured slot on the selected date with public-safe `AVAILABLE`, `PROMOTION`, `UNAVAILABLE`, `PAST`, or `NOTICE_REQUIRED` status. Booked/manual/blocked slots all become generic **UNAVAILABLE** in public data; no customer names, booking source or block reasons are exposed. Closed hours yield no fabricated slot. Existing `slots` remains AVAILABLE-only for compatibility, preserving server-side purchase validation.
- Date requests are scoped by venue and day, with stale result guards, fallback read-only cached snapshots, disabled offline reservations, and click-through details for **all** statuses. Only a live AVAILABLE/PROMOTION slot can navigate to /booking/confirm, where the API again validates time, price and occupancy. Promoted booking deep links keep their selected date and highlight.
- No new database migration. `pnpm verify:venue-slot-grid` is included in `pnpm verify`; new booking API integration tests ensure occupied slots remain visible-but-not-bookable, restriction windows are represented, and private booking fields are not leaked. Android visual comparison against the owner Week grid remains recommended.

## Public Team Detail — View Team six-tab profile (2026-10-11)
- Teams → View Team now mounts `TeamDetailExperience` instead of a vertically stacked profile/roster. Premium blue cover, logo, location, follower/member/privacy stats, Follow/Unfollow, request-to-join (PENDING disables duplicates), Manager action, and native share remain at the top. Main tabs: **Media**, **Squad**, **Matches**, **Competitions**, **Statistics**, **About**. Each tab has two context subtabs and keeps its active selection; horizontally scrollable, accessible, blue highlighted, with Dari/Pashto RTL layout and translated labels.
- Media → Posts / Photos includes only PUBLIC + PUBLISHED team posts, native comments routing and full-screen photo viewer. Squad → Players / Leadership renders public members or approved-member/manager roster, honoring PRIVATE team roster visibility; player taps open player profiles. Matches → Upcoming / Results shows real published-competition fixtures/scores with match detail deep links. Competitions → Active / Past shows only published, ACCEPTED competition registrations. Statistics → Overview / Recent Form derives played/W/D/L/goals/win rate from published, completed or corrected match results. About → Overview / Membership holds team description, city, district, province, founding date, designated public phone, privacy status, and approved-member-only activity/announcement links.
- New read-only `GET /api/v1/teams/:teamId/public-highlights` in `TeamManagerPhase3Service` returns limited published posts, published competition matches, accepted competitions, and official-result aggregate stats. It rejects archived/unclaimed offline teams and never returns WhatsApp invite links, internal team activities, invitations, membership contacts, private announcements, venue booking data, or unreleased team manager growth workspace information. A separate authenticated request remains responsible for roster and join-request access control; anonymous reads cannot access member-only data. No database migration.
- Existing `/teams/[teamId]` route re-exports the dedicated public component; older social/team verifiers were adapted to follow the actual UI implementation. `pnpm verify:public-team-detail` is included in the repository-wide `pnpm verify` chain. GitHub CI and a real Android RTL/English walkthrough should be checked after deployment. **No fake matches, posts or statistics are displayed.**


## Public Venue Reserve slot interaction and contact (2026-10-11)
- **Bug fix:** The customer venue timetable previously displayed the selected-slot card below the long Week/Day grid, making taps appear to do nothing. Free/PROMOTION tiles now open a visible, centered slot-action dialog immediately; booking navigates to the existing live, server-revalidated /booking/confirm flow. Dates and times are localized to the venue timezone, without ambiguous UTC offsets.
- **Private own-reservation overlay:** The timetable fetches `GET /api/v1/bookings/me` only with the current authenticated user's access token. It matches `venueId` + `areaId` + exact start time, filters to noncancelled ONLINE bookings owned by the session's user ID, and overlays a distinct blue **Your Reservation** tile with PENDING/CONFIRMED status and a cancellation-policy snapshot. Owners of their own online booking can inspect the record and request cancellation behind an explicit confirmation; `POST /api/v1/bookings/:id/cancel` remains the authority on ownership and timing, and the grid refreshes on success. Manual phone/WhatsApp reservations are not presumed to be the user's unless stored through existing booking association.
- **Other occupied slots:** Public `UNAVAILABLE`, PAST and NOTICE_REQUIRED slots are disabled for tapping unless identified as one's own authenticated booking. The public timeline does not reveal occupant details, manual/online booking source, reason for a block, or any private venue operating data. A failed /me read never enables other users' occupied slots.
- **Direct venue contact:** A visible **Call venue** action uses the explicitly published venue `publicPhone`; **Message on WhatsApp** uses only the owner's separately configured optional `whatsappPhone`. Only that opted-in WhatsApp number is surfaced via the public venue DTO; no unrelated private phone is exposed. Phone numbers are validated/normalized for tel and wa.me links, including Afghan 07xx and +93/0093 formats. Prefilled English/Dari/Pashto WhatsApp messages optionally mention selected start/end time, current display price and venue name, explicitly stating that sending a message does **not** hold or confirm inventory. The owner must create/confirm manual bookings using the existing server occupancy workflow; external messages cannot bypass pricing or booking authorization. Calling/contact options remain accessible while online booking is paused.
- **Verification:** `pnpm verify:reserve-actions` is included in full `pnpm verify`, testing phone format guards, opt-in only WhatsApp links, localized messages, private booking guards, accessibility and modal action wiring. No migration: database already holds `whatsappPhone` from venue setup. Real-device Android call and WhatsApp app-link handling, confirmation and cancellation UX still require manual testing.

## Consistent compact time-slot tiles — venue reserve and owner timetable (2026-10-11)
- Shared `SlotTileContent` under `apps/mobile/src/components/ui/` now defines one compact tile face for customer **Reserve → Available Slots** (both Week and Day), **Reserve → Offers**, and venue-owner **Time Table → Calendar** (Week and Day). Month view remains a date selector, not a per-time slot grid. Detailed booking/management dialogs retain complete start/end, status and cancellation or pricing information.
- Tile displays venue-local start time at the **physical top-left** in a 12-hour clock with English AM/PM (`6:00 AM`, `1:30 PM`, `12:00 PM`), a hairline separator across the interior, and compact price at the **physical bottom-right** (`500 AF`). Alignment does **not** reverse for Dari/Pashto; navigation and calendar date formatting remain RTL/Solar-Hijri-aware as before. Full booking amounts continue to say AFN outside tiles.
- Status colors, promotion/reservation markers (now top-right so they do not clash with time), pressed/disabled states, exact time selection, customer privacy guards, owner's slot management, live server confirmation, and phone/WhatsApp contacts are preserved. Slots use compact ~54px minimum height instead of the former taller customer cards and day owner tiles; day/week grid rows adjust to fit.
- `apps/mobile/src/lib/slot-display.ts` centralizes the venue-timezone 12-hour formatter and the compact AF suffix; `pnpm verify:compact-slots` checks real timezone examples, noon/midnight, short pricing, corners, separator, and all three slot surfaces. Existing `verify:venue-timetable`, `verify:venue-slot-grid`, and `verify:reserve-actions` remain in full verification. No schema or migration changes. Android density and RTL visual QA is still needed.

## Diagonal compact time-slot separator (2026-10-11)
- Updated shared `SlotTileContent` to match the supplied two-tone diagonal reference: the boundary slopes **bottom-left to top-right**, separating start time in the upper-left from price in the lower-right, instead of a straight horizontal hairline. The triangle darkens the original status-aware background and preserves readable status-specific text and corner markers without introducing orange/black over the existing booking color legend.
- Pure React Native triangular borders are measured from each tile's layout, keeping the diagonal responsive for both narrow week cards and wider day cards without a new package or database migration. Layout measurements are memoized to prevent repeated reflows; diagonal is decorative and cannot intercept taps.
- Existing `pnpm verify:compact-slots` now asserts responsive diagonal geometry rather than a horizontal line. This applies simultaneously to public venue Reserve day/week slots, Reserve Offers, and owner calendar day/week slots; all booking and management flows remain unchanged.

## My Reserves dashboard + higher-contrast diagonal slots (2026-10-11)
- Replaced the former basic `/(tabs)/bookings` listing (raw ISO and immediate cancellation buttons) with a polished, responsive **My Reserves** experience shared with **Venue → Reserve → My Bookings**. The presentation lives in `apps/mobile/src/components/bookings/ReservationsPanel.tsx`, used by both surfaces. Dashboard includes real Upcoming/Pending/Completed summary counters; All, Upcoming, Pending, Completed, Cancelled filters; chronological upcoming-first grouping; venue identity and action shortcuts; local Kabul date/time without raw ISO or UTC offsets; booking price, source, reference code; optional note and stored cancellation-policy details; status badges and pending-approval explanation; empty/filter-empty/loading/error/offline states; explicit refresh and pull-to-refresh on the global page; browse venues or view venue/find available slots actions.
- A **Cancel booking** action is reachable from expanded details only for future, non-cancelled reservations; a two-step confirmation modal shows the correct venue/date/policy and awaits a live server-authorized cancellation. It prevents double-submission, refuses offline attempts and retains the modal with an error if server cancellation fails. On success, its cancellation result updates the visible record and revalidates the list. No auto-cancellation or unsupported refund promises.
- Global `GET /api/v1/bookings/me` responses are filtered by `playerUserId === session.user.id`; a per-user loaded marker prevents briefly showing another account's reservations during account changes, and a focus/request-sequence guard prevents stale responses overwriting new state. Venue-specific bookings retain actor AND venue filters. Backend booking privacy and atomic cancellation authorization remain authoritative. One venue per court remains unchanged.
- English, Dari and Pashto have all new dashboard labels and messages; RTL page direction and calendar dates remain language-aware. Added `pnpm verify:my-reservations` to the full verify chain, covering statuses, ordering, secure fetch guards, confirmation, reuse and three languages.
- Shared **diagonal slot tile** contrast now uses the original pale status background and strong dark time text in the upper-left, an opaque matching deep status-color lower-right field with a **white price**, and **the same 12px bold font size** for the displayed 12-hour time and `AF` price. The change applies automatically to public Reserve daily/weekly slots, Offers, and owner timetable daily/weekly slots. Status markers retain a white backdrop for contrast. No additional package or DB migration.
- Full CI checks confirm static/code verification; mobile device visual review remains necessary, particularly for narrow weekly slots, RTL labels, and native cancellation modals.

## Instant timetable slot actions and processing feedback (2026-10-11)
- **Root cause on customer Reserve:** `Slot` was defined inside `VenueSlotTimetable`, causing React to discard and remount every tile when a selected slot changed. Each remounted tile reconstructed date/time formatters and performed its responsive diagonal `onLayout` work, which can stall low-end Android devices and delay the native modal. Week rendering also repeatedly scanned all slots for every day/time cell and built new Intl instances.
- **Fix:** The public `Slot` now has stable module-level identity wrapped in `memo`; only changed tile props re-render. `ownBySlot` and Week `slotsAtTime` indexes are computed once for each API result, not on every tap. Tap callbacks are stable. 12/24-hour time formatters are cached per venue timezone. Click handling performs **no network request**: it immediately selects the already-loaded slot. A small centered, high-contrast **ActivityIndicator** overlays the touched tile while the modal is being presented; the indicator has a short failsafe timer and accessible busy state.
- **Owner timetable:** Week and Day renderer trees are wrapped in `memo` with stable selection and layout callbacks, so opening the owner-side slot management modal avoids reconstructing the entire timetable grid.
- **Safety retained:** Only actually available/promotion or authenticated user's own existing booking tiles can open details; other occupied slots remain disabled. Online booking still requires connected, fresh server-authoritative availability and reservation confirmation; cancellation still uses the authenticated API. Existing time/price diagonal colors and RTL layout remain intact.
- **Verification:** `pnpm verify:slot-interactions` has been added to full `pnpm verify`, in addition to `verify:reserve-actions`, `verify:venue-slot-grid`, and other release checks. The new regression covers stable component identities, indexed renders, local processing feedback, no network on tap, booking privacy and owner grid isolation. The actual perceived timing still needs manual Android testing against the user's device/network.

## Rounded slot triangle containment and 15% tone reduction (2026-10-11)
- Corrected the diagonal wedge bleeding beyond a slot's rounded border: the shared `SlotTileContent` clips its measured border triangle inside an inset rounded rectangle, and **all outer tappable slot cards** now clip overflow at their border radius (public Reserve Day/Week, venue-owner timetable Day/Week, and customer Offers). This fixes visible triangular corners without changing tile dimensions, tap hit targets, or blocking indicators.
- Time-background fill and diagonal price-background fill are now independently softened exactly **15% toward white** using the reusable pure `softenSlotColor` utility: colors are blended as opaque RGB values rather than applying opacity to the whole slot (which would fade text). Strong status-specific time text and **white, 12px bold price text** remain unchanged, along with status indicators and booking actions. Closed/blocked owner slot's ink uses a darker gray for legible white prices.
- Extended `pnpm verify:compact-slots` to check precise color blending, price contrast conventions, nested clipping in every venue and owner surface, and the responsive diagonal. No new dependency or database migration; real device visual QA is recommended.

## Referee role exclusivity (2026-10-11)
- A **venue owner may promote only an active Normal User into referee authority** using `POST /api/v1/owner/referees`. The referee must not already have **any `user_roles` role**, a player profile, active team membership (including captain/manager), managed team, owned venue, pending/active paid owner/manager subscription, or another venue referee grant. Eligibility is checked **inside the authoritative database transaction** and serialized per candidate user before inserting a venue-specific grant. A repeat grant to the *same* venue is idempotent; a previously authorized referee at another venue is not an eligible new Normal User. Existing assignments are not silently deleted or converted.
- New error **HTTP 409 `REFEREE_NORMAL_USER_REQUIRED`** explains the target must be an unassigned base account. Venue Owner → Referees shows a localized English/Dari/Pashto explanation and error. Suspended, deleted, or unknown accounts remain ineligible. The venue owner cannot appoint themselves.
- **No dual Player + Referee role later:** while the venue referee grant exists, activating a player profile, accepting a team invitation, approving a join request, or activating/requesting a paid manager/owner role is rejected with `REFEREE_ROLE_EXCLUSIVE`. These checks are server-side; client role labels are never trusted. The team/invite and paid activation paths also use the per-user transactional lock for consistent grants. Removing referee access uses the existing owner workflow, and does not implicitly delete team records or change historical match reports.
- Tests: new unit cases enumerate all roles and hidden affiliations; owner API integration checks rejection and same-venue idempotency. Existing demo seed roles remain distinct (`abdul` Player and `Saeed` Referee), so no seed or database migration is needed. Historical invalid dual-role accounts must be reviewed separately rather than auto-modified.

## Admin Panel completion — Phase 1 / 7 (2026-10-11)
- See `docs/ADMIN-PHASE-01.md` for all six tasks. The admin has been split into reusable modules while retaining its 9 existing sections, manual team claims and team slot administration; responsive grouped desktop/mobile sidebar, breadcrumbs and RTL labels in three languages are in place.
- Admin Users and Venues now use live, actor-authorized server-side pagination (default 25), accurate total counts, and independent section loads, with stale-response protection, abortable requests and no cached administrative reads. Existing legacy endpoints remain compatible.
- The dedicated web-admin session now uses sessionStorage and removes legacy persistent localStorage credentials; API admin claims are checked against fresh DB roles on each privileged request. High-risk admin writes use confirmation modal with target, reason and error/busy handling; reusable pagination, status badges and empty states are shared.
- New `pnpm verify:admin-phase1` and API `admin-foundation.test.ts` cover refactor safety, server pagination, role revocation and modal actions. No DB migration or dependency changes.
- **Outstanding before unrestricted production:** full MFA/step-up implementation and native/browser manual QA; advanced sorting/filtering and user/role details belong to the domain phases. Do not present Phase 1 as proof of these later controls.

## Admin Panel completion — Phase 2 / 7 (2026-10-11)
- Implemented the five planned tasks **Dashboard KPIs, Revenue Analytics, User Growth, Business Performance, and Attention Center**. See `docs/ADMIN-PHASE-02.md`.
- New admin-only `/api/v1/admin/analytics?days=7|30|90|365` uses PostgreSQL aggregate queries grouped by Asia/Kabul-local dates, excludes cancelled/pending GMV, excludes voided payments, and returns no customer-level PII. Recorded revenue **only** covers non-voided venue subscription ledger entries; Team Manager role and paid extra slots show active counts without fictitious income.
- Dashboard adds dated period KPIs, quick attention counters, compact trends, and links. New **Analytics & Reports** sidebar page includes period selection, responsive daily/weekly/monthly charts, registered user growth, confirmed booking performance, trial-to-recorded-payment conversion, current paying-venue share, role grants and venues by province.
- Supports English, Dari, Pashto, RTL and Solar Hijri report date labels; no chart dependency or database migration. `pnpm verify:admin-phase2` and admin API integration tests cover bounded access, finance classification, grouping and view wiring.
- Remaining: actual app usage/DAU cannot be inferred from ACTIVE accounts; role subscriptions lack a comparable receipt ledger; ticket/report workflows await later phases; live DB and browser QA are required before broad production.

## Referee Profile — exclusive dashboard mode (2026-10-11)
- Fixed Profile → Dashboard Role: accounts holding `REFEREE` permission now see **only Referee**, never Player, Team Manager or Venue Owner dashboard modes. Shared pure `availableDashboardRoles` preserves the existing choices for non-referee accounts and covers legacy conflicting combinations safely without rewriting database roles.
- The `/dashboard` resolver prioritizes verified Referee status over any previously stored `PLAYER` preference. The legacy `/dashboard/player` route redirects referees to `/dashboard/referee`, preventing an old bookmark from reopening Player dashboard. The referee route itself retains its role guard; server-scoped referee authority remains enforced.
- Added `pnpm verify:referee-dashboard-only` to full `pnpm verify` to test single-option profile, legacy preferences, direct URLs and unaffected regular/owner account choices.
- No database migrations or dependencies. Device visual QA: sign in as a referee and inspect Profile → Dashboard Role, try older Player preference and direct Player deep link.
