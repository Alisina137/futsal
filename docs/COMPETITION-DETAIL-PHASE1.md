# Competition Detail — Phase 1: Player Privacy, Async Reliability & Navigation Foundation

Date: 2026-10-15. Public competition profile, match stats backend and profile navigation.

## Implemented
- **Public player privacy:** aggregated competition leaderboards and individual finalized-match player statistics now require an explicit PUBLIC player profile, ACTIVE account, and ACTIVE membership in the recorded team. A private profile's account display name is **never** substituted as a public player identity. The competition service also excludes teams without accepted participation and unfinished match statistics. No new DB migration.
- **Reliable competition refresh:** generation-scoped public competition, media and private participation reads ignore obsolete responses. On account/competition switches, private registration, teams, organizer permissions, invitation controls, and stale follower state are invalidated. Re-focusing revalidates private rights instead of reusing stale privileges. Errors preserve explicit retry and private operations fail closed.
- **Seven-tab foundation:** Home, Matches, Standings, Statistics, Teams, Media, About with contextual second navigation. All seven route to actual existing or server-backed content. Key format-aware visibility (League/Groups/Knockout), registration-only and participation-only tabs; per-main subtabs retained and safely validated. Legacy Results URLs still route to Matches > Results; old standings, stats, bracket and teams redirects continue working.
- **Media** reuses published updates/photo viewer. **About** supports information, scoring/tie-break rules, existing organizer-defined prizes, and the host venue; dedicated full About details remain accessible.
- **Statistics** exposes verified team counts, the existing player leaderboard, and disciplinary totals without inventing any formal fair-play points/rank.
- English, Dari and Pashto navigation strings and RTL selection.
- Navigation unit tests and structural privacy/async verifiers are in `pnpm verify:competition-detail-phase1`, integrated into release-readiness.

## Next-phase scope preserved
- Phase 2: polished Home summary and sharing.
- Phase 3: improved match subtabs, schedules and live refresh across tabs.
- Phase 4: bracket visualization and advanced standings/qualification.
- Phase 5: separate Teams registration/My Participation from organizer-only work.
- Phase 6: robust team/player/fair-play statistics and ranking.
- Phase 7: paginate media and expand About.
- Phase 8: full Android/real PostgreSQL acceptance.

## Manual Android and real DB QA remaining
1. Log in as venue owner, team manager, player, basic user and guest; switch accounts and competitions during slow API requests; verify no stale private information or organizer controls.
2. Switch formats across LEAGUE, GROUP_KNOCKOUT, KNOCKOUT; only supported stage subtabs appear and selected state aligns in RTL and English.
3. Check legacy links to Results/Bracket/Standings/Stats/Teams and direct public About.
4. Publish two match player stats for a PUBLIC and PRIVATE profile, deactivate one user/remove another from active roster; confirm neither leaderboard nor match detail publishes excluded identities.
5. Test competition with zero published teams, completed scores, player stats, reward entries and media; ensure nothing is invented.
6. Test public media/photos, fullscreen preview, venue destination, long translated labels, large text and narrow Android viewport.
7. Test registration and invitation errors, retry, back/foreground, and return after permission revocation.
8. Verify APIs and UI still enforce organizer ownership and registration fee/capacity/deadline policies.

**CI does not constitute on-device acceptance or real-database privacy certification.** Those checks are separate remaining tasks.
