# Public Team Detail — Phase 3: Squad and leadership

Date: 2026-10-15
Scope: Public **Teams → View Team → Squad** only; this is not the unrelated Teams-directory Phase 3 or the Team Manager dashboard.

## Implementation

- **Players:** real, API-returned active roster members, displayed in responsive cards with player photo/initials, display name, server-validated position, jersey number, and Manager/Captain role badge. Entries are sorted by manager, captain, then jersey number (unknown jerseys last), and finally display name.
- **Search and position filters:** localized search across player display names and jersey numbers, plus accessible horizontal position chips (All, Goalkeeper, Fixo, Ala, Pivo, Universal, Unspecified). Filtering never modifies server data. Empty search results are distinct from a team with no publicly visible roster.
- **Leadership:** existing **Squad → Leadership** tab shows *only* visible manager/captain membership entries (with source-of-truth user IDs as a fallback if role data is temporarily out of date). Its explanation and empty states never reveal a hidden leader’s name.
- **Privacy and transparent counts:** roster total continues to come from the existing active-membership count. A visible-of-total indicator explains the difference if members are hidden because of privacy, without implying the hidden member identity or inventing any profile. PRIVATE team rosters remain inaccessible to anonymous/nonmembers; approved members/managers continue to use the existing protected roster API.
- **Player-profile links:** authorized member roster access can expose teammate profiles marked PRIVATE. A public `/players/[playerId]` link is now active **only** for player IDs previously present in the server’s public filtered team roster. This prevents dead links and accidental attempts to deep-link to private profiles. No new public API, player biography, contact information or team-manager private data is exposed.
- **Async account isolation:** public profile IDs reset when switching teams/accounts and are populated only after the current team load generation succeeds. Existing Phase 1 stale-response defenses and Phase 2 eligibility actions remain intact.
- All new text is localized to English, Dari and Pashto; responsive RTL and horizontal focus continue to be handled by the existing shared navigation. No database migration or dependency changes.

## Automated release gate

```powershell
pnpm verify:team-detail-phase3
pnpm verify:team-detail-foundation
pnpm verify:team-detail-phase2
pnpm verify:teams-phase3
pnpm verify:teams-phase6
pnpm verify:public-team-detail
pnpm typecheck
```

The new Phase 3 verification runs six deterministic, isolated Node tests for sort, leadership fallback, Unicode and jersey search, empty results, private-team authorization, and private-profile links. A structural verifier checks backend roster privacy and the mobile filtering UI, translations, stale-load guard, responsive cards and safe deep linking. Both are included in `pnpm verify`.

## Manual Android / RTL QA required

| Scenario | Expected |
| --- | --- |
| Public team has 12 active members, 8 with public profiles | Guest sees only eight cards and an accurate visible-of-12 indicator. No hidden names. |
| Player selects PRIVATE profile visibility | Guest stops seeing that card after refreshing; previously loaded card cannot navigate to private profile. |
| Approved team member opens roster | Full authorized roster loads; private-profile cards are non-linking, public-profile cards open correct player screen. |
| Private team as guest vs approved member | Guest sees lock message and no players; approved member sees private roster. |
| Captain changes or role record is delayed | Only an actual visible, active leader is displayed. No fabricated leader card. |
| Filter by Goalkeeper, Fixo, Ala, Pivo, Universal or Unspecified | Exact server positions filter correctly; All resets the choice. |
| Search partial Latin/Dari/Pashto name or jersey number | Case-insensitive localized matching; search + position compose without stale results. |
| Change to Leadership then back to Players | Same original search/filter remain; leadership ignores position filter. |
| Rapidly switch teams, accounts and app navigation | No previous-team player IDs, photos or private roster appear. |
| Narrow device, big font, RTL tabs/chips | Names, badges and controls remain legible; selected tabs remain horizontally visible. |

Physical Android/device performance, authenticated database behavior and RTL screenshot sign-off remain manual acceptance work. Static and CI checks alone do not certify device behavior.
