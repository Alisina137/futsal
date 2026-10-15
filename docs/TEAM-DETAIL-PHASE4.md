# Team Detail — Phase 4: Matches experience

Date: 2026-10-15
Scope: Public Team Detail → Matches → Upcoming / Results. Existing competition organizer scheduling and score-verification workflows remain authoritative; no new match creation/editing controls.

## Implemented

- **Published-fixture summary:** Upcoming/live and completed match counts from the server's bounded public fixture snapshot, not claimed as career/season totals. Unpublished competitions and unaccepted team registrations stay out of the response.
- **Functional search:** Opponent, competition name and competition round/stage search. Input is bounded to 100 characters and works together with competition and status/outcome selections.
- **Competition filter:** Only competitions actually referenced by returned matches are selectable. Selecting a competition filters both Upcoming and Results; no invented or unauthorized competitions.
- **Upcoming subtab:** Live, Scheduled and Postponed status chips. Live matches appear first, scheduled matches are earliest-first, postponed matches last; missing kickoffs remain at the end of their status group. The status remains authoritative even if a scheduled kickoff is already in the past. Cancelled matches are not misrepresented as upcoming.
- **Results subtab:** Completed/corrected entries most recent first, with Win/Draw/Loss filters calculated from *confirmed score pairs and home/away team IDs*. A completed match with no actual score shows **Result not available yet**, never a fake zero or W/D/L. Corrected results are labeled as corrected. Live scores are not depicted as verified final scores.
- **Match cards:** Competition, stage, current match status, actual home and away teams, visible verified score or VS, team-centric result, and a clean date/day plus 12-hour AM/PM clock in Afghanistan timezone. Unknown opponent/kickoff uses honest placeholders. Both **Match details** and **View competition** open existing routes.
- **State and privacy:** Search/filters persist when toggling between Upcoming and Results; **Clear filters** resets them. Switching team/account clears any prior match search/competition/status/outcome filters; existing Phase 1 async guards remain. No private match notes, venue-owner info, referee instructions or unpublished stats are exposed.
- **Localization:** New controls, statuses, result and empty-state wording added in English, Dari and Pashto. Selected chips, touch sizes, narrow devices and RTL use the established app patterns. No new dependencies or database migration.

## Release verification

```powershell
pnpm verify:team-detail-phase4
pnpm verify:team-detail-foundation
pnpm verify:team-detail-phase2
pnpm verify:team-detail-phase3
pnpm verify:teams-phase3
pnpm verify:public-team-detail
pnpm verify:global-ampm
pnpm typecheck
```

The Phase 4 command runs six unit tests covering server status categorization, score completeness, null dates, sort order, name/competition/stage queries, Win/Draw/Loss rules and exclusion of non-team/cancelled matches, plus a structural API/UX privacy verifier. The command is included in `pnpm verify` and CI runs the full verification and Expo web export.

## Manual Android acceptance (pending)

| Scenario | Expected |
| --- | --- |
| Upcoming has live, scheduled, postponed, null kickoff | Live first, scheduled chronological, postponed last, pending kickoff labeled accurately |
| Completed with verified score | Actual final score and correct team-centric W/D/L badge |
| Corrected verified result | Updated scores and Corrected Result label, correct W/D/L |
| Completed without verified score | No fabricated result or W/D/L; shows pending result |
| Scheduled or in-progress with provisional scores | VS, never labelled official final result |
| Filter by a real competition | Only that competition's matches across both subtabs |
| Search by opponent, competition or stage | Correct bounded filtering; combines with competition and result/status chip |
| Clear filters | All filters reset and complete snapshot items return |
| No matches or filters produce zero hits | Appropriate localized empty state, not an error or fake match |
| Date crossing midnight in Kabul | Correct day/date and AM/PM with no UTC +04:30 suffix |
| Open match and competition | Existing published competition/match routes navigate and return correctly |
| Switch team rapidly with network latency | Previous team's filters/results do not appear in the new team |
| RTL on small Android device | Chips, cards and action controls remain legible and selected tabs visible |

Automated code verification does not substitute for a physical Android, live database or manual RTL acceptance pass. The public snapshot intentionally includes up to 100 most-recent fixture rows; it is not a complete historical results API.
