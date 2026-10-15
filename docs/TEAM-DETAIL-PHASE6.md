# Public Team Detail — Phase 6: Verified statistics, recent form and player leaders

Date: 2026-10-15. Scope: Public Team Detail → Statistics (Overview, Recent form, Top players). This is separate from venue/competition stats.

## Implemented
1. **Overview:** displays actual server-wide completed/corrected published competition results: played, wins, draws, losses, goals for/against, goal difference and win rate. A real W/D/L distribution bar and numeric percentage breakdown replaces an uninformative win-rate-only progress bar. Zero-result state stays explicit. A consistency notice appears when raw server counters do not reconcile. No fabricated numbers.
2. **Recent form:** displays up to five newest verified fixtures *for the selected team only*, including home-vs-away correct score orientation and Win/Draw/Loss indicator. Tapping a row opens its existing real match detail. Missing score, unrelated-team games, unverified statuses and incorrect timestamps are excluded. Copy clearly states this is a sample from the API's recent 100-match snapshot, not the team's exhaustive history.
3. **Top players:** filters through public server-provided player statistics only. The user can sort independently by Goals, Assists or Appearances; deterministic ties use the other metrics and name. Player rows display the selected metric prominently with other metric values and link to the existing public player profile. Invalid negative/corrupted metric values are rejected. Server privacy still enforces public profiles and active memberships before a player is returned.
4. **Reliability:** player-metric selection resets between team/account switches; existing stale-response guards, route validation and public stats loading/retry remain in force. New localized text in English/Dari/Pashto and accessible selected-state controls preserve RTL.
5. **No migrations/API endpoints/dependencies.** Statistics come solely from the existing `public-highlights` endpoint.

## Automated verification
```powershell
pnpm verify:team-detail-phase6
pnpm verify:teams-phase3
pnpm verify:teams-phase5
pnpm verify:public-team-detail
pnpm typecheck
```
Four focused Node suites test team-only recent form, corrected/verified results, home/away orientation, leaderboard sorting and corrupt data exclusions, plus zero-safe outcome percentages and server-counter consistency. Source guards protect backend public-profile privacy. The new verifier is included in full `pnpm verify`.

## Android / production manual QA remaining
- Check real stats for a team with no matches, a team with 1–5 matches and a team with 100+ published matches; overview must reflect full verified history but form is limited to recent available fixtures.
- Verify corrected results are displayed with authoritative server scores and correct W/D/L from both home and away team pages.
- Verify Goals/Assists/Appearances filters re-rank players and remain readable with long names, high font scaling and RTL.
- Confirm player with PRIVATE profile is not listed, while public players can open their own public player detail.
- Check successful refresh and team/account switch on slow connection, including no stale prior-team leaderboard.
- Check selected statistics subtab and horizontal visibility in English, Dari and Pashto.
- Confirm competition match details open from Recent form, and error/empty cases do not show fake data.

No claim is made that CI substitutes for physical Android or production-database acceptance.
