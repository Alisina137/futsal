# Referee Dashboard — Phase 8 Security and Release Gate

## Scope
This gate covers the referee role only: overview, invitations/assignments, calendar,
match center, reports, verified career and settings. It does not replace the
platform's existing broader Android release requirements.

## Automated checks
From the repository root, after installing dependencies:

```powershell
pnpm verify:referee-dashboard-release-phase8
pnpm --filter @leaguekick/api exec vitest run test/referee-dashboard-phase8.test.ts test/referee-phase1.test.ts test/referee-phase2.test.ts test/referee-phase3.test.ts
pnpm --filter @leaguekick/api typecheck
pnpm --filter @leaguekick/mobile typecheck
pnpm verify
```

The Phase 8 GitHub Actions workflow runs the dedicated unit/source checks and
both TypeScript checks. The normal Release Readiness workflow runs the complete
monorepo checks plus Expo web export. A green workflow only certifies the exact
commit SHA that was tested.

## Database prerequisite
The Phase 7 `0044_referee_settings_availability` migration adds
`referee_profiles.accepting_assignments`. **A GitHub commit does not migrate a
remote database.** Back up the target first, then apply migrations with
`pnpm db:migrate` using the correct database connection. Confirm the column,
then test a paused referee against the connected API. Avoid test writes against
production data.

## Staging manual acceptance matrix (not implied by CI)

1. **Identity and access:** Sign in with a referee, venue owner, ordinary user,
   and a second unrelated referee. Only the rightful referee may load/edit a
   report; only the competition's venue owner may approve/return it. Repeat
   after suspension, reassignment, declined invitation and venue-role removal.
2. **Invitations:** A paused referee cannot accept even with an allowed
   exception date. No enabled weekly days means unavailable unless a date
   exception permits it. Conflicting match times, own-team conflict and expired
   invitations are rejected by the server.
3. **Live match lifecycle:** Confirm assignment; complete checks; start;
   pause/resume; advance period; record goals/cards/assists; remove an event
   with reason; finish; save summary; submit; organizer returns with correction;
   referee resubmits; organizer approves. Verify public scoreboard and career
   reflect **approved only** results.
4. **Offline preservation:** Disconnect during a live match; stage two distinct
   events; restart the app; reconnect; verify each event syncs exactly once and
   the queue shrinks only after acknowledgment. A failed or corrupt cache must
   display a recovery warning without erasing pending events.
5. **Account switch and revocation:** Switch from referee A to B while a
   request is in flight. No A-specific data, event queue, profile, venue or
   analytics may appear for B. A 401/403 must not show cached overview data.
6. **Localization:** Repeat critical screens in Dari, Pashto and English.
   RTL calendars use Solar Hijri and Saturday-first weeks; English uses
   Gregorian and Monday-first weeks. Verify Kabul-local AM/PM everywhere.
7. **Reports and PDF:** An unapproved report must not be downloadable.
   Approved PDFs are private to the correct referee or organizer. Tickets are
   short-lived and single-use; reusing a ticket must fail.
8. **Release UX:** Test Android device back gestures, background/reconnect,
   accessibility labels, small screens, font scaling, initial loading,
   read-only offline states, error/retry and notification deep links.

Record: device/OS, build SHA, API SHA, database migration level, role/account,
scenario, expected/actual outcome and defects before approving the release.

## Rollout / rollback
Deploy the API and mobile client against a migrated **staging** database first.
Release to production only after operator sign-off. If Phase 8 regressions occur,
disable the rollout or revert application commits and redeploy the prior build;
**do not automatically roll back** a non-destructive database column migration.
Preserve referee offline drafts/queues; clearing app data can permanently lose
unsynced match events. Protect database backups and secrets.
