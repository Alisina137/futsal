# Teams Phase 6 — Integration, Authorization & Release QA

Date: 2026-10-13  
Scope: Teams directory, public team profile, team manager workspace, requests/invitations, social media, official fixtures/statistics.

## Automated release gate

Run from the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm --filter @leaguekick/mobile exec expo export --platform web --output-dir dist-web
```

`pnpm verify` includes `verify:teams-phase1` through `verify:teams-phase6`, TypeScript checks, unit/integration tests, and the project build. GitHub Actions runs the release gate for every PR.

### Automated integration and security coverage

| Area | Expected invariant | Regression guard |
| --- | --- | --- |
| Team privacy | Anonymous public roster excludes PRIVATE player identities, while private authorized roster may display full active team membership | `teams-phase6-integration.test.ts` + `verify:teams-phase6` |
| Accurate roster count | Hiding player cards never changes the actual membership total | `verify:teams-phase6` |
| Team invitation identity | Invitation accepts case-insensitive linked account email or legacy username/phone | `teams-phase6-integration.test.ts` |
| Role safety | Referees cannot accept player invitations or join via pending manager approvals | `teams-phase6-integration.test.ts`, transactional SQL guard |
| Status safety | Inactive/unclaimed teams cannot accept team invitations | `teams-phase6-integration.test.ts`, server repository guard |
| Membership role safety | Pending invitations cannot demote an already active captain/player/manager | `teams-phase6-integration.test.ts`, server repository guard |
| Async team isolation | Team detail and manager components reject stale responses after team switches | `verify:teams-phase6` |
| Invitation UI | Only one accept/decline request at a time; invitations refresh on focus | `verify:teams-phase6` |
| Public feed | Published-only posts, bounded paging and refresh | `verify:teams-phase5` / `verify:teams-phase6` |
| Official matches | Only published, accepted competition matches count toward public results and statistics | `verify:teams-phase5` / API unit tests |

## Manual acceptance matrix — Android / Expo Go

These are **manual smoke tests to perform on a real device**. Source and CI checks do not establish whether these user-interface interactions function correctly on a physical phone.

| ID | Steps | Expected outcome |
| --- | --- | --- |
| TEAM-01 | Open Teams, scroll followed teams, tap Show More, navigate back | Followed rail and detail navigation remain correct |
| TEAM-02 | Search by team name, city, province and district; clear filters | Suggestions and results reflect current search; no stale cards |
| TEAM-03 | Switch sorting, paginate, quickly change query | Old page responses cannot overwrite current result set |
| TEAM-04 | Open a public team, choose each of six main tabs and subtabs | Active tab stays visible; first subtab is selected by default |
| TEAM-05 | Open a team with a PRIVATE-profile player | Private player is not shown on public squad list, but team count stays correct |
| TEAM-06 | Log in as approved member and open private roster | Authorized active member sees permitted full squad |
| TEAM-07 | Open private team without membership | Private squad stays hidden; join policy and public profile work |
| TEAM-08 | Request to join, navigate to Teams list, navigate back | Pending state is synchronized across directory and detail |
| TEAM-09 | Cancel request from directory, re-open team detail | Pending control disappears; request can be made again if enabled |
| TEAM-10 | Manager reviews, rejects then approves separate applications | Status transitions and roster update after each action |
| TEAM-11 | Manager invites by username and verified/linked email | Invitation delivered to correct account; repeated invitation rejected |
| TEAM-12 | Accept invite while on invitations page, then return to team | Role, roster access, invitation badge and join state refresh |
| TEAM-13 | Decline another invitation and press action twice quickly | Exactly one transition; no duplicate/cross-card decision |
| TEAM-14 | Try to accept an invitation after a manager has already assigned player membership | Existing role is preserved, stale invite is rejected |
| TEAM-15 | Try to accept an invitation using a referee account | Player membership remains prohibited |
| TEAM-16 | As multi-team manager, switch between two managed teams | Roster, requests, invitations, draft media, settings and activity are not mixed |
| TEAM-17 | Publish team post with and without photo; edit and delete | Public posts/photos update after refresh; delete asks confirmation |
| TEAM-18 | Load multiple pages of posts, then navigate to another team | No items from previous team remain in media view |
| TEAM-19 | View official matches, results, competitions and statistics | Only published completed/verified game scores affect team record |
| TEAM-20 | Open Top Players and inspect goals/assists/appearances | Only eligible public active players appear and can open their profile |
| TEAM-21 | Repeat navigation and listings in Dari/Pashto RTL and English LTR | Direction, active tab, dates and action labels remain usable |
| TEAM-22 | Disconnect network during requests and retry when restored | No fake success, stale roster or permanently stuck spinner |

## Release boundaries

- No new database migration is necessary for Phase 6.
- There are no changes to billing/subscription pricing or role permissions except closing the invite/roster security gaps.
- GitHub Actions validates source/tests/build/export. Actual device testing, hosted database checks and production load testing must be signed off separately; **do not treat CI success as physical-device certification**.
