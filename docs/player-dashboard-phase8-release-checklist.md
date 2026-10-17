# Player Dashboard — Phase 8 release checklist

> Automated source checks and unit tests do not prove that Android interactions,
> authentication, the live API, notifications or the database work end to end.
> Keep the release **pending** until real-device and live-service checks are signed off.

## Automated verification

- [ ] `pnpm verify:player-dashboard-phase8` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes (including API service tests).
- [ ] `pnpm --filter @leaguekick/mobile build` passes.
- [ ] Record the commit SHA and investigate any failure before release.

## Android / Expo Go acceptance

- [ ] Sign in as a verified Player and inspect the five main tabs: Overview, My Teams, Activity, Career, Settings.
- [ ] Navigate all Activity (Competitions, Matches, Schedule, Bookings) and Career (Statistics, Achievements, History) subtabs.
- [ ] Check the Overview profile, current team, stats, next match, invitations and quick-action destinations.
- [ ] My Teams: search, view team, change default, accept/decline invitation, cancel pending join request, leave after confirmation.
- [ ] Attempt a join request as an unverified user and as a non-eligible role; the UI blocks it and the API enforces the rule.
- [ ] Activity: inspect published matches and lineup statuses; confirm completed match results are official.
- [ ] Calendar: check Day/Week/Month navigation and that adjacent events do not count as conflicts.
- [ ] Confirm Saturday-start week in Dari/Pashto and Monday-start week in English.
- [ ] Confirm 20–21 March 2026 Solar Hijri year/month transition in Dari/Pashto; English calendar remains Gregorian.
- [ ] RSVP to an upcoming team activity and verify the updated availability after refresh.
- [ ] Create a personal booking, check the Bookings tab, cancel only after explicit confirmation and refresh.
- [ ] Career: filter by team, competition, season and result; verify totals, match history and public-only trophy sharing.
- [ ] Settings: edit/save/discard preferences and default team; open email, credentials and notification settings.
- [ ] Switch from Player A to Player B during a slow API request; confirm no private data, errors, filters, or dialogs leak.
- [ ] Disconnect then reconnect the API; independently retry Activities and Bookings.
- [ ] Review labels, long strings, icons and scroll behavior in English, Dari and Pashto on a narrow Android screen.

## Release decision

- Status: **PENDING real-device and live-service testing**.
- Assigned tester: __________   Date: __________   Commit: __________
- Failures and repro steps: __________
- Sign-off: __________
