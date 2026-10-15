# Competition Detail Phase 3 — Matches, Fixtures and Live Refresh

Date: 2026-10-15. Scope: public Competition Detail → Matches and shared public competition refresh.

## Implemented

- Matches main subtabs (Upcoming, Live, Results, All) now synchronize with the existing status chips. Completed/Corrected results remain grouped under Matches → Results; postponed and cancelled fixtures remain reachable by choosing their existing status chips inside All.
- The prior team, stage, group and round filters are preserved, with a new **Kabul-local date filter**: All dates, Today, Tomorrow and Next 7 days. Date windows use `Intl.DateTimeFormat` with `Asia/Kabul`, including fixtures that cross midnight relative to UTC. A fixture without a valid kickoff remains in All dates but never enters a date-scoped view.
- Match filter selections live in Competition Detail rather than exclusively in the child, surviving switches between Match subtabs and other tabs. The preferences reset for a different competition. If a team/stage/group/round disappears, the visible filter normalizes to valid data rather than hiding the entire list because of a stale selection.
- For exactly one **accepted registration belonging to the current authenticated account**, a My Team shortcut focuses that team's real fixtures; it is unavailable without that authorization or for a pending application.
- A real visible-matches count and explicit clear action in empty filtered states keep users oriented. Existing round grouping, referee-aware Kabul date/time, today indicators, playable home/away links, match detail navigation, venue/court link, and official result status remain.
- An unobtrusive manual refresh button in Matches, Standings and Statistics fetches **only the public competition snapshot**. A single foreground timer fetches every 25 seconds while Home, Matches, Standings or Statistics is focused. The application never retries registration/follow or organizer writes as part of polling.
- Background/previous account/previous competition polling responses are rejected using the existing actor-identity and load-generation checks, preserving the existing public snapshot during transient API errors and preserving scroll/filter state.
- Added localized English, Dari and Pashto labels for filters, My Team and refresh, RTL-aware chips, pure Kabul date/permission normalization tests and a release verifier wired to `pnpm verify:competition-detail-phase3`.

## No breaking changes

No database migration, new API route or dependency. Existing competition public/team privacy predicates, accepted registration requirements and legacy Results routes remain unchanged. Existing media, stats, team tabs and owner management workflows remain.

## Verification

```powershell
pnpm verify:competition-detail-phase3
pnpm verify:competition-detail-phase2
pnpm verify:competition-profile
pnpm verify
pnpm --filter @leaguekick/mobile exec expo export --platform web --output-dir dist-web
```

## Physical Android and real API QA remaining

1. Home → Matches and legacy Results links. Verify that choosing status filters switches to the correct main subtab and returning from match details keeps the selected facet.
2. Open live match details, finish/correct the score in organizer/referee flows; leave Matches and Standings open >25 seconds and verify genuine score/standing changes without flicker or resetting filters.
3. Open Matches near 23:59–00:01 Kabul time (UTC+04:30) and check Today/Tomorrow/Next 7 days include the correct local-day fixture without off-by-one.
4. Switch accounts rapidly between pending-registration user, approved team manager, venue organizer and guest, as well as between competitions, ensuring My Team is shown only for the authorized single accepted team.
5. Check phone with slow/no network: existing public match list remains after failed silent refresh, manual refresh gives retry error and neither follow nor registration request is duplicated.
6. Exercise groups/rounds/team/date combinations, postponed/cancelled/unscheduled fixtures, full/empty results, narrow screens, large text, EN/Dari/Pashto RTL and press through to match/team/venue details.

Automated tests/CI do **not** certify the production Android app or real PostgreSQL data. Manual signoff is a future release task.
