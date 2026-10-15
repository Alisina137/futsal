# Team Detail — Phase 1: Navigation and request reliability

Date: 2026-10-15  
Scope: Existing public Team Detail at `/teams/[teamId]`, **not** the team-manager dashboard or the Teams directory.

## Implemented

- The six existing main tabs remain **Media, Squad, Matches, Competitions, Statistics, About**; the first/default destination is **Media → Posts**. All current subtabs and business actions are retained.
- A typed navigation state remembers **each** selected subtab when switching main tabs. Main-tab presses do not jump the outer page back to top. Horizontal focus stays aligned with the selected main/subtab and works in English LTR and Dari/Pashto RTL.
- Optional `tab` and `subtab` route parameters are validated against known tab/subtab pairs, e.g. `/teams/<id>?tab=matches&subtab=results`, `?tab=stats&subtab=topPlayers`, or `?tab=about&subtab=members`. Invalid parameters safely fall back to the first subtab; switching to another team starts at the correct default/route destination.
- Team/account context changes clear old profile/roster/public-feed/member-request state and invalidate stale loads, follow/unfollow writes and join/cancel writes, with the same per-account authorization boundaries as before. Older media-page requests cannot leave a disabled **Load more** control behind after refresh/team change.
- Added reliable selected/accessibility state and main-tab test IDs, retained the existing no-fake-data loading/empty/error states, and left server-based membership, visibility, results and invitation rules unchanged.
- **No schema migration, new paid role, or dependency changes.**

## Automated gate

```powershell
pnpm verify:team-detail-foundation
pnpm verify:navigation-focus
pnpm verify:public-team-detail
pnpm verify:teams-phase3
pnpm verify:teams-phase6
```

`verify:team-detail-foundation` runs seven navigation-state unit tests (defaults, memory, allowed deep links, invalid parameters, shortcuts, inactive tabs, new teams) and a source invariant test for async, role and privacy guards. It is included in `pnpm verify`, alongside the existing repository checks.

## Manual Android acceptance (still required)

| Scenario | Expected |
| --- | --- |
| Select Media → Photos, then Stats → Top Players, switch away and back | Both subtabs remain selected and horizontally visible |
| Navigate directly with `?tab=matches&subtab=results` | Results opens; unrelated subtabs keep defaults |
| Reopen another team from Teams directory | Media → Posts default; no first team's profile/photos/request status |
| Rapidly change teams while network responses are slow | Earlier roster, highlights and follow count cannot leak |
| Sign out of an approved member account while viewing a private roster | Private player identities disappear until a fresh authorized load |
| Follow / join, then navigate to another team before request finishes | Old response cannot update the new team's status or spinner |
| Reload public feed, cancel/retry pagination | No stale post list or permanently disabled Load more |
| Check English / Dari / Pashto on narrow Android, with long names | Selected main and sub tabs remain visible in LTR/RTL; no vertical jump |
| Reconnect after network loss and retry | Real data reloads; no invented stats or public/private leaks |

Physical-device testing, network throttling and backend integration signoff are **not** claimed by this source change.
