# Competition Detail — Phase 4: Standings and Official Tournament Bracket

Date: 2026-10-15 | Repository: Alisina137/futsal

## Completed implementation

- **League standings:** retain the official server-computed league standings, shared pinned team column, horizontally scrollable statistics, five-match verified form and team detail preview. Never derive a new ranking from match summaries or change the official tie-break rules.
- **Group standings:** group the returned official positions by published group label, alphabetically and deterministically. Add an All Groups / per-group selector and group participant counts for tournaments that use groups. Group standings retain the real `qualifiersPerGroup` rule. The provisional-zone banner and established green row indicators explicitly state they are *not* confirmed qualification.
- **Knockout visual board:** show an RTL-compatible, horizontally scrollable tournament bracket containing successive **actual** knockout rounds sorted from higher round number to the final (`roundNumber=1`). Each official match has clickable detail, home/away names, status, and scores **only for completed or corrected, scored matches**. Unknown teams and dates remain unfilled rather than guessed.
- **Verified progression:** only display a green official advancement label where a finalized scored source fixture specifies the real winner, a valid `nextMatchId`, the correct `nextMatchSide`, an existing later-round knockout fixture and that next match already records the same winner in the designated slot. Draft, live, cancelled, forged winner, wrong-slot and incomplete tournament links never become invented progression. The original round selector, result cards and safe next-match navigation remain available below the visual bracket.
- **Synchronized navigation:** tapping the internal Group / Knockout stage selector updates the appropriate main Standings subtab using the existing format-aware navigation; legacy Bracket links and league-only behavior remain. Same-account competition focus revalidates published data as implemented in prior phases.
- **Localized and accessible:** EN/Dari/Pashto labels, RTL horizontal ordering, accessible match cards and group filters, no app dependencies or DB/API changes.

## Regression verification

```powershell
pnpm verify:competition-detail-phase4
pnpm verify:competitions-phase5
pnpm verify:competition-profile
pnpm verify
```

10 focused unit tests cover round/slot ordering, official winner progression, unresolved/forged/wrong-round links, group ranking, league ranking, provisional zone and empty states. Structural release checks inspect the actual UI/parent navigation and all three locale variants.

## Outstanding Android and real database acceptance

1. Inspect 4/8/16-team knockout brackets with long team names, future fixtures and bracket final, including landscape/portrait, small screens and RTL.
2. Use organizer result entry: advance valid winner through several rounds; correct/retract a score; ensure public progression changes only after the official next fixture is updated.
3. Verify that LIVE, POSTPONED, CANCELLED and unresolved fixtures do not show *confirmed* winners, even if cached/provisional scores are present.
4. Switch between League, Groups and Knockout subnavigation; check group selection, back behavior, deep links and content refresh while viewing standings.
5. Cross-check all table ranks, points and tie-break values with the real competition engine for tied teams, correction flows and qualifier counts. Do not treat provisional positions as a guarantee of qualification.
6. Compare results under EN, Dari and Pashto, high font scaling and offline/recovered network. Team privacy and offline manual teams must retain safe links.

**Passing CI does not replace physical Android and PostgreSQL production-like acceptance.**
