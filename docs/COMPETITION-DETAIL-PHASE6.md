# Competition Detail — Phase 6: Verified Team Statistics, Player Leaderboards and Fair Play

Date: October 15, 2026.

## Delivered

- Statistics keeps the planned **Teams / Players / Fair Play** sub-navigation.
- **Teams:** counts only scored `COMPLETED` or `CORRECTED` official fixtures where both sides are accepted participants. Computes played, wins, draws, losses, goals for, goals against and goal difference from the same finalized matches, without mixing live/postponed/unscored/unauthorized team fixtures. Stable statistical sorting is intentionally distinguished from the official standings tie-breaks. Registered online teams link to public team profiles; offline teams never get broken links.
- **Players:** preserves seven verified metric leaderboards (goals, assists, appearances, clean sheets, yellow/red cards and player-of-match awards), team filtering and public player profile links. Existing API privacy filters continue to exclude non-public identities and ineligible player memberships. No additional personally identifying data is introduced.
- **Fair Play:** presents a low-card-count ordering across accepted teams from actual public player-stat totals, with yellow/red totals and an explicit notice that missing player records can make these totals incomplete. This is **not** an official disciplinary-points or fair-play-award ranking, and does not falsely assert disciplinary innocence from absent data.
- Added localized explanatory text in English, Dari and Pashto; improved stats layout, accessibility, safe links and RTL responsiveness. No schema migration or new dependency.

## Automated verification

```powershell
pnpm verify:competition-detail-phase6
pnpm verify:competition-detail-phase5
pnpm typecheck
pnpm verify
```

A dedicated test validates score corrections, played/W-D-L totals, zero-result competitions, excluded unaccepted team matches and the accepted-only recorded-cards aggregation. Source invariants guard privacy scopes, UI hooks, original metric leaderboards, 7-tab navigation and translated copy; Phase 6 gate is registered in the root verification chain.

## Outstanding release acceptance (manual)

- Check Android/iOS with actual PostgreSQL and published official results, including scorer corrections, abandoned fixtures and knockout byes.
- Check public player metric accuracy against real verified match event data; test guest, revoked-player, private-profile and unaccepted-team scenarios.
- Check teams with missing card events, double yellow/red combinations and discipline history. This screen must not be described as an authoritative fair-play award.
- Check all seven leaderboard filters and player links on EN/Dari/Pashto, RTL, small phones and large fonts.
- Confirm production CI runs `pnpm verify`; a GitHub source update alone is not equivalent to a local typecheck/build or real-device verification.
