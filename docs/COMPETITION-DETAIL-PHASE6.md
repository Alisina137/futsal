# Competition Detail — Phase 6: Statistics and Fair Play

Date: 2026-10-15. Public Competition Detail > Statistics: **Teams / Players / Fair Play**.

## Implementation

- **Team statistics** show accepted participants' verified whole-competition totals from official `COMPLETED`/`CORRECTED` fixtures with both team IDs and actual home/away scores: played, wins, draws, losses, goals for, against and difference. League, group and knockout scored fixtures are all included. Results involving removed/non-accepted teams, partial/absent scores, postponed, cancelled and live games never count. A knockout score that remains drawn is recorded as a draw even when the official winner advances via a tiebreaker; do not invent the shootout score. Records are **not** relabeled as league table standings. Teams without finalized matches have an explicit zero-data explanation.
- **Player leaders** retain seven real metrics (goals, assists, appearances, clean sheets, yellow cards, red cards and player of the match), accepted-team selector, positive-recorded-events-only lists, stable rank sorting and verified public player links. Leaderboard privacy gates remain in the API: PUBLIC profile, active account/membership and accepted team. Existing manual/public refresh updates the view without private writes.
- **Fair Play** now uses a **distinct server-side team-only disciplinary aggregate**, not the privacy-filtered player leaderboard. The new `teamDisciplineStats` optional public DTO field reports yellow/red card totals for accepted teams from finalized matches, including card incidents belonging to private-profile players **without identifying the player**. SQL verifies team registration status, match competition ID and actual participation in the recorded match. The public service filters accepted IDs again before responding. Zero records and an older server without the aggregate are distinguished; the UI does not invent a fair-play score, suspension policy or proof of card-free conduct. Teams are ordered by fewer recorded red and then yellow cards for browsing only.
- Compact seven-stat team cards, safe real team links (no broken offline-team profile link), EN/Dari/Pashto translations, RTL orientation and explanatory reporting banners. Main/sub-navigation and 25-second foreground public refresh remain unchanged.
- No database migration or dependency additions. Deploy **API and mobile together** to enable the new aggregate; old API responses show an explicit unavailable state.

## Verification

```powershell
pnpm verify:competition-detail-phase6
pnpm --filter @leaguekick/api test
pnpm typecheck
pnpm verify
```

The new pure tests cover accepted-team W/D/L and goal math across formats; drawn knockout scores and corrections; empty/partial/live/byes; removed teams; no-card-vs-missing-aggregate; team-only card sorting and metric leader filtering. Additional Vitest API test checks server public acceptance filtering and no private-team payment or player identity in card totals. The phase verifier asserts three locales, contract, server SQL trust boundaries, UI, 7-tab navigation and refresh. The new gate is wired into the full `pnpm verify` chain.

## Remaining device / real-DB acceptance

1. On Android, inspect Teams / Players / Fair Play in EN, Dari and Pashto, including narrow screens, large fonts, team links and RTL chips.
2. Against real PostgreSQL, record completed/corrected match results, including corrections and a tied knockout decided by tiebreaker; compare all W/D/L and goal totals to the official saved scores.
3. Record yellow/red cards for both public and private-profile players; verify only the sum appears in Fair Play, with **no** private player name or link exposed. Verify player leaders remain public-only.
4. Withdraw/reject a team and confirm its team and card totals disappear on refresh; test in-progress/unscored/postponed games contribute nothing.
5. Test a competition without cards, one with cards, and an old-API response without `teamDisciplineStats` to confirm distinct honest empty/unavailable states.
6. Check background/foreground auto-refresh, explicit refresh, rapid account or competition switches, flaky network and delayed reads to preserve previous phase's race and privacy fixes.

**Manual Android and production database acceptance are outstanding and must be completed before release signoff.**

Next: Phase 7 — Media and About; Phase 8 — final cross-tab regression and release readiness.
