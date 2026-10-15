# Public Team Detail — Phase 6: Verified statistics

Date: 2026-10-15
Scope: Team Detail → Statistics → Overview / Recent form / Top players.

## Delivered

1. **Overview.** Retains the existing **authoritative all-time server aggregation** across *all completed/corrected matches in published competitions with accepted team registration*. The improved header highlights real win rate and recorded-match count. Eight verified metric tiles show played, wins, draws, losses, goals for, goals against, difference and win rate. The segmented result bar shows verified W/D/L shares, and the win-rate progress bar clamps incorrect API values instead of overflowing. No fabricated “zero matches” win rate when none exist: header shows an em dash and the existing informative no-results message.
2. **Recent form.** Uses the latest available completed/corrected fixtures with **non-null scores**, validates that this team actually participated, and calculates win/draw/loss from its home or away perspective. The five most recent recorded results are shown as a form strip and as detail cards (opponent, verified score, actual competition name and Kabul-local AM/PM date). Each card opens the real match detail route. Corrected matches count as finalized; in-progress, unrelated and missing-score fixtures are excluded. Because public highlights contain only the latest 100 fixtures (which may include unplayed matches), recent form is explicitly described as a *bounded public snapshot*, not an all-time history. A capacity notice appears when the limit is reached.
3. **Top players.** The prior API returned *only the top 20 by goals*; that excluded legitimate assist and appearance leaders from alternate rankings. The server now returns the **union of the top 20 eligible players by goals, assists and appearances** (at most 60 unique public players). The mobile app offers three independent metric tabs; each shows the proper top 20 with ranking, primary metric and supporting goals/assists/appearances, and links to the existing public player profile. The backend continues to require a PUBLIC player profile, ACTIVE player membership, ACTIVE user, ACCEPTED team registration, PUBLISHED competition, and COMPLETED/CORRECTED match. Non-public player details are never inferred or added to the response.
4. **Language and UX.** New metric names, context and warning labels support English, Dari and Pashto. Filters are accessible; selected buttons expose their state; horizontal controls and card ordering remain RTL-aware. Statistics ranking resets to Goals after switching team/account. The existing network refresh and stale-data protection from prior phases remain unchanged.
5. **Tests / release gate.** Pure unit tests cover home/away/verified form, deterministic order, ranking by all metrics, no-data and safe graph widths. New Vitest backend coverage proves high-assist and high-appearance players stay discoverable even when 25 goal scorers rank above them, without exposing private players. Source invariants and `pnpm verify:team-detail-phase6` are included in the full `pnpm verify` CI chain.

## Verification

```powershell
pnpm verify:team-detail-phase6
pnpm verify:team-detail-phase5
pnpm verify:teams-phase5
pnpm verify:public-team-detail
pnpm typecheck
pnpm test
```

GitHub Actions also checks the full repository verification chain and Expo web export.

## Manual Android and backend acceptance (outstanding)

| Scenario | Expected result |
| --- | --- |
| Team with five published finalized results, alternating home/away | Correct W/D/L from team perspective, actual score and opponent, each card deep-links to the match |
| Published game is IN_PROGRESS, POSTPONED, CANCELLED or missing score | Omitted from form and official aggregates until complete/verified |
| Corrected match result | New final score and outcome replace the old state on refresh |
| Team with more than 100 public fixtures | Warning that recent form is only a bounded snapshot; all-time overview still includes all qualified matches |
| 25 scorers, separate assist/appearance specialist | Goals/Assists/Appearances chips all surface their legitimate top-ranked public players |
| Player changes profile to PRIVATE or loses active membership | No listing or public profile leak after refresh |
| No published finalized fixtures or active public players | Accurate empty messages, no fictitious win rate, card or player |
| Narrow Android, large text, Dari/Pashto RTL | Metric selectors remain visible, no clipping/overlap, scores read logically |
| Switch team/account rapidly | No prior-team private player stats or stale metric-selection leak |
| Go offline / refresh on focus | Existing loading and retry UX; no invented data |

Physical-device QA, live production data acceptance and screenshot sign-off are not claimed as complete.
