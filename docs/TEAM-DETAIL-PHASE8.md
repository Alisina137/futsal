# Team Detail — Phase 8: Full Regression and Release Readiness

Date: 2026-10-15.
Scope: complete **Team Detail** six main tabs and their subordinate tabs, including signed-out, basic unverified, verified role-free, player, captain, team manager and assigned-other-role accounts.

This is the closing cross-cutting quality and privacy phase following Team Detail Phases 1–7. **Automated release readiness is not a substitute for testing the actual Android build and production API.**

## Fixes implemented

**Immediate reauthorization on returning to a team.** Previously, Team Detail used a focus-triggered asynchronous reload, but continued to render the previously loaded team's private roster and member navigation until that request resolved. If membership or captain access was revoked while the app was visiting another screen, the UI could temporarily show stale private information. The profile reload now clears the previous privileged roster, membership, manager profile and previous gallery photo **before** requesting current server data, so the page shows its existing loading skeleton until the current roster/roles have been revalidated. Existing actor-switch and generation checks continue to reject late responses from another team/account. No private data is added to the public API.

**Refresh on all six tabs.** Users can now trigger a real refresh on Team Detail Media, Squad, Matches, Competitions, Statistics and About. Public media/match/competition/stats tabs use the public-highlights refresh; Squad and About request the current team and roster/member eligibility again. The button is disabled during outstanding loads; writes (follow, request join or cancel) remain explicit and are never retried automatically.

**Regression suite.** Added integration-style pure Node tests across actual navigation, membership, squad, match, competition, stats, and public contact helpers, not screenshots or mocked success claims:
- Navigation and deep links across six main tabs and subtab persistence, including rejection of malformed deep link inputs.
- Guest, unverified email, assigned role, invitation-only and pending request behavior; member and manager grants.
- Private team roster and player-profile deep link isolation.
- Team-only fixtures, completed/corrected results, team-perspective home/away scores and published competition filters.
- Official statistics versus the latest public verified-fixture sample, ranking by all three player metrics.
- Safe public phone numbers, optional home venue links, truthful follower-count display.
- Empty/unavailable datasets without invented results or members.

A **Phase 8 release verifier** additionally locks down required six-tab UI surfaces, privacy gates, account/team request-generation invalidation, refresh buttons, and the published/accepted/active player backend predicates. It checks required English, Dari and Pashto strings for every main tab and release-critical action.

## Verification commands

```powershell
pnpm verify:team-detail-phase8
pnpm verify:team-detail-phase7
pnpm verify:team-detail-phase6
pnpm verify:team-detail-phase5
pnpm verify:team-detail-phase4
pnpm verify:team-detail-phase3
pnpm verify:team-detail-phase2
pnpm verify:team-detail-foundation
pnpm verify
pnpm --filter @leaguekick/mobile exec expo export --platform web --output-dir dist-web
```

The release workflow executes `pnpm verify` and the Expo web export. Phase 8 is included in the full verification chain. No database migration, production deployment, Android native artifact, or additional dependency is needed.

## Physical Android and real API acceptance checklist (not automated)

| Scenario | Expected |
| --- | --- |
| Sign out / sign in / swap accounts while Team Detail is open | No old player's roster, member resources or personal pending request visible |
| Approve, revoke or transfer team membership while Team Detail is open elsewhere | When refocused, immediately show loading skeleton, then fresh role and member actions |
| Public team roster and player profile visibility | Only returned public players can be deep-linked; private player profile stays inaccessible |
| Private team, user without member privileges | No private roster data or member resource shortcut even after refresh |
| Role-free verified normal account | May request membership only when policy allows |
| Unverified email / another assigned role / invitation only | No request bypass; accurate disabled/verification message |
| Rejected, cancelled, pending and accepted request | Correct status and cancellation/approval flows; no duplicate request |
| Team manager or captain | Exact current role; edit/manage restricted to manager and member links only to approved accounts |
| Media → Posts, Photos | Published-only media, pagination, image enlargement, working post and comments navigation |
| Squad → Players, Leadership | Search by Unicode/jersey/position, counts and management/captain roles |
| Matches → Upcoming, Results | Live/scheduled/postponed, win/loss/draw by own team, competition filters and match detail routes |
| Competitions → Active, Past | Published/accepted only, lifecycle and format filters, cap notice and real match preview |
| Statistics → Overview, Form, Top players | Accurate published aggregate, recent verified results, public-goals/assists/appearances leaders |
| About → Overview, Membership | Public phone/home venue safety, accurate team info, authorized private resource links |
| All six tab refresh buttons | Loading controls disable, fresh data after recovery, network failures display retries |
| Narrow Android, tablet, RTL Dari/Pashto and font scaling | No clipping, selected tab visible, labels correctly translated, readable cards |
| Rapid tab switching and slow/flaky mobile data | No stale account/team results, duplicate writes or endless spinners |
| 0/1/50/100+ fixtures/posts/competitions | Honest empty states, pagination and bounded history |
| Airplane mode → network reconnect | Explicit safe retry; no automatic re-submission of a follow/join/payment write |

## Release decision

Automated CI success plus manual Android and real-API acceptance is required before treating Team Detail as *production release signed off*. Screenshots/device checks and production-team permission tests cannot be certified from GitHub-only tooling and remain outstanding.
