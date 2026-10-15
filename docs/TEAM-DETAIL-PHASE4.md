# Team Detail — Phase 4: Matches and results

Date: 2026-10-15. Scope: public Team Detail → Matches (Upcoming, Results).

## Implemented
- Upcoming fixtures show real scheduled, live and postponed matches, with live first and chronological kickoff order; unscheduled fixtures appear last.
- Results show completed and corrected records with newest kickoff first, explicitly handling missing scores rather than fabricating results.
- Upcoming has All / Live / Scheduled / Postponed filters. Results has All / Wins / Draws / Losses based on the current team's home/away orientation and actual numeric scores.
- Each tab has an optional competition selector drawn only from competitions on that team's visible matches; filters and competition choice are remembered independently between Upcoming and Results and cleared when team or account changes.
- Competition titles link to their real competition details; each match card links to its existing match detail route.
- Match cards include genuine stage, localized status, verified score (when present), team-oriented result badges, competition, and correctly formatted Kabul-local 12-hour AM/PM kickoff times through the existing formatter.
- Empty results distinguish no scheduled matches from filters that have no matches. The entire view uses EN/Dari/Pashto and accessible selected-state controls.
- No new API endpoint, database migration, dependency or invented fixtures.

## Verification
`pnpm verify:team-detail-phase4` runs pure logic tests and structural guards. CI runs the full `pnpm verify` chain and Expo web export.

## Remaining manual Android QA
1. Switch between Upcoming and Results with distinct status and competition filters; selections persist.
2. Verify genuine live, postponed, corrected, completed and pending-score cases.
3. Check a team appearing as home vs away: Win/Loss badges must follow that team's perspective.
4. Open competition title and match detail button, including after switching tabs.
5. Check long team/competition names, narrow screen, RTL Dari/Pashto and AM/PM with no explicit UTC+04:30 offset.
6. Change team/account mid-load; previous team's filtered selections must not leak.
7. Test missing dates and zero matches without fictitious scores, plus refresh/error behavior.

Physical device, production API and backend integration testing have not been claimed.
