# Venue Owner Dashboard — Phase 5: Competition Management (2026-10-15)

## Implemented

The Venue Owner's **Competitions > All Competitions** page is now an operational management directory, built on the existing owner-authenticated `GET /api/v1/owner/competitions`. Existing competition card identity, registration fees, accepted team count, status/publication badges, and create/owner management flows remain intact.

**Directory:** Search by competition/venue, lifecycle groups (All, Registration Open, Active, Drafts, Finished), individual status chips, format filters and start/name sorting. Active is based on the stored competition status, not guessed from a kickoff date. Empty/failed reads never masquerade as an absence of tournaments. Owner data is refreshed on focus, every 60 seconds in the foreground, and through pull-to-refresh. Responses from a prior focus or auth token cannot replace a newer snapshot; values are only visible for the current owner token.

**Organizer action panel:** Every competition has a **View organizer actions** button that lazily loads only its own fully authenticated `GET /api/v1/owner/competitions/:competitionId` detail. This avoids fetching sensitive applications for every tournament in the directory or fabricating counts from the public list DTO. It provides exact stored counts of pending or applied teams, accepted teams, unfinished fixtures lacking a referee, and the next scheduled or in-progress match (actual stored teams/time). Retry, error state and token/request generation guards are included. Action links open **Registration / Teams** and **Fixtures** in the existing private organizer console; an Offline Teams shortcut links to venue-scoped local team management.

**Owner deep links:** Organizer console now accepts explicit `?tab=TEAMS` and `?tab=FIXTURES` initial and changed routes, with default Overview for unsupported values. It preserves the existing invitation, approval, direct offline team acceptance, result entry, referee, brackets, settings and stage workflows without creating duplicate authorization/write paths.

**Offline Teams:** Existing create/edit, owner venue scoping and admin transfer behavior remain. The list and edit form now scope state to the current account; late responses from an earlier signed-in owner are ignored.

**Product scope notes:** The directory has *no fabricated global count* for pending tournament applications because the lightweight list contract does not expose this. Organizers can inspect the accurate count per competition on demand. Existing backend authorization, competition transitions, match publication and registration decisions remain authoritative; this phase does **not** introduce an uncontrolled bulk-update endpoint or subscriptions for offline teams. No schema or endpoint migrations.

## Verification

```powershell
cd C:\projects\futsal
pnpm verify:owner-dashboard-phase5
pnpm verify:competition-organizer-invite
pnpm verify:offline-teams
pnpm typecheck
pnpm verify
```

Tests cover lifecycle grouping, combined search/status/format and sorted results, missing-date treatment, actual pending and accepted team counts, unassigned/unfinished fixtures and upcoming matches; source gates check role-scoped owner endpoints, navigation/deep link handling, stale-actor rejection and English/Dari/Pashto localization.

### Expo Go / real PostgreSQL QA still required

Log in as two different venue owners with distinct competitions and offline teams; switch accounts mid-fetch and verify no other venue's details appear. Create draft, open-registration, active, finished and archived competitions; test every filter (including RTL names), empty/error/retry states, refresh, and the returned status badges. Inspect a competition with APPLIED/PENDING/ACCEPTED/WITHDRAWN teams; ensure organizer preview counts and Teams deep link agree. Open a competition with scheduled, completed, postponed and in-progress matches, some missing referees; verify preview then Fixtures deep link. Confirm that an unauthorized owner cannot manage another venue's competition. Test on Android Expo Go in English, Dari and Pashto, including returning from owner competition edits and Offline Teams. CI/web export are not physical release signoff.

**Next phase:** Phase 6 — Media & Marketing dashboard.
