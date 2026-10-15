# Competition Detail — Phase 8: Final Regression and Release Readiness

**Date:** 2026-10-15  
**Scope:** Public Competition Detail (7 top-level tabs; contextual subtabs from Phases 1–7), public APIs, manager/user participation, publication/privacy, localization, and mobile resilience.  
**Release decision:** **NOT YET APPROVED for production.** Automated regression files have been added, but this execution environment cannot run the repository's pnpm/Node workspace, open a physical Android device, or connect to the production-like PostgreSQL instance. A successful GitHub merge is code delivery, **not** release sign-off.

## Issues found and corrected in Phase 8

1. **Optional media failure could disable the entire competition page.** The profile used to await both the public competition API and Home media together. It now requests the authoritative public profile independently and loads the optional published-media preview asynchronously; a media failure yields an empty media preview instead of denying the whole competition. Delayed responses are discarded when the competition/account generation changes. Media is filtered to its correct competition ID and PUBLISHED status.
2. **A failed later media page took two taps to retry.** The inline retry control now retries the same missing page directly, without discarding the previously displayed pages or resetting sorting.
3. **Home verified results could differ from Statistics.** Home now counts only finalized, complete, non-negative integer scored fixtures between distinct **currently accepted** participants. This matches Statistics' public whole-competition count rather than inflating the Home badge with unfinished, removed-team or invalid matches.

These are targeted corrections: no new databases, roles, permissions, migrations or dependencies.

## Automated acceptance

```powershell
cd C:\projects\futsal
pnpm install --frozen-lockfile
pnpm verify:competition-detail-phase8
pnpm verify:competition-detail-phase1
pnpm verify:competition-detail-phase2
pnpm verify:competition-detail-phase3
pnpm verify:competition-detail-phase4
pnpm verify:competition-detail-phase5
pnpm verify:competition-detail-phase6
pnpm verify:competition-detail-phase7
pnpm --filter @leaguekick/api test
pnpm typecheck
pnpm verify
```

The new `scripts/tests/competition-detail-phase8.test.mjs` covers real pure-helper behavior: all seven tabs; format-aware standings; guest-only versus participating-user subtabs; legacy Results deep links and invalid subtab fallback; tab/subtab state preservation; registration open/deadline/full/closed alignment; Home-vs-Statistics official result parity; no fabricated champion/winner/qualification; withdrawn-team visibility; player/fair-play aggregates; manager duplicate registration eligibility; Kabul midnight filtering and invalid saved filters.

The new `scripts/verify-competition-detail-phase8.mjs` audits key source invariants: both navigation levels, account/competition stale-request protection, public-versus-private data separation, server-bound source data, media failure isolation and direct page retry, public SQL visibility filtering, all required EN/Dari/Pashto tab/subtab labels, and inclusion of Phases 1–8 in the full release gate. The tests are deliberately additive to the prior Phase 1–7 gates; failures must be fixed rather than suppressed.

## Mandatory real-device acceptance — record PASS/FAIL per scenario

| # | Area | Roles / conditions | Expected |
|---|---|---|---|
| 1 | Entry / navigation | Guest, authenticated player, team manager, venue owner; direct links and back | Seven tabs resolve; stale legacy Results links open Matches > Results; tab changes do not reset unrelated selected subtabs |
| 2 | Formats | LEAGUE / KNOCKOUT / GROUP_KNOCKOUT | Only appropriate standings substages show; no invented empty qualification path |
| 3 | Status | DRAFT, registration open/closed/full/expired, ongoing, completed, archived, cancelled | Draft not available publicly; no registration when closed/full/expired; actions accurate by status |
| 4 | Home | Upcoming/live/corrected/finalized fixtures, champion, withdrawn participant | Hero badges, next fixture, champion and recent posts derive from published real records; verified result totals equal Statistics |
| 5 | Matches | Live/scheduled/completed/corrected/postponed/cancelled; group and knockout | Exactly one correct status section per filter; date/team/round facets; proper deep links, correct timezone |
| 6 | Standings | League tie-breaks, groups, knockout with bye, unfilled round, penalty winner | Official table and bracket only; no manufactured score, progression or qualification |
| 7 | Statistics | Missing results, correction, removed team, private-profile player, disciplinary events | Verified played/WDL/goals correct; player identity visibility enforced; fair-play team-only aggregate excludes removed teams; missing API feature not mistaken for zero cards |
| 8 | Teams | Guest, unrelated manager, applicant, invited, accepted, withdrawn | Only own participation/private controls visible; no duplicate requests; server rules enforce fee and capacity; account switch clears personal rows |
| 9 | Media | 0/1/12/13+ posts, photos, multiple dates, publication changes, unknown images | Updates and Photos sorted, paginated, correctly scoped; no private/draft/other-competition posts; viewer back/next and share work; page retry is single-tap |
| 10 | About | No dates, long description, all formats, team and individual rewards | Accurate public registration/rules/prizes; no fictional policies; venue link opens actual host; full About remains available |
| 11 | Failure isolation | API available + media unavailable or stalled; optional media recovers | Main public Competition Detail opens successfully; missing Home preview is nonfatal |
| 12 | Network | Airplane mode, intermittent failure, slow older requests; resume | No stale responses from previous competition/actor; no duplicate mutation; retry for each section; already-loaded media pages retained |
| 13 | Privacy | Sign out/in as another user, revoke owner role, remove team, unpublish competition | Private participation/actions promptly cleared; public endpoint refuses drafts; old-session response ignored |
| 14 | Accessibility | Android portrait/landscape, small screens, screen reader, large text | Nav labels and focus usable; buttons 44px minimum where applicable; modal close and page actions reachable |
| 15 | Language | English (LTR), Dari (RTL), Pashto (RTL), switch language while on a subtab | All labels localized; RTL ordering; clocks in user language/Kabul time, no clipped navigation |

## Real PostgreSQL acceptance

- Seed two public competitions, a draft competition, one removed participant, one PUBLIC and one PRIVATE player, both public and non-public social posts, and a corrected result.
- Verify `GET /api/v1/competitions/:id`, `GET /api/v1/competitions/:id/media?page=1&limit=12&kind=photos&sort=oldest`, the legacy no-query media endpoint, match details and role-scoped participation for each actor.
- Verify strict media query validation; PUBLIC+PUBLISHED and exact competition ID filters must occur in SQL **before** pagination. Cross-check whether a post's image URL actually renders on device.
- Confirm that no feePaymentReference, other user's pending registration, account-private player display name, or private/non-public post leaks into guest responses. Verify accepted-team SQL disciplinary aggregates and updated results against stored records.
- Test account switching during delayed responses and simultaneous media pagination; monitor server/Expo logs for unhandled errors and memory growth.

## Exit criteria

**Release allowed only when**: (1) all phase 1–8 verifiers, API tests, `pnpm typecheck` and `pnpm verify` pass against the same merge commit; (2) device acceptance items 1–15 pass in EN/Dari/Pashto for required roles and competition formats; (3) the real PostgreSQL visibility, paging and result-correction checks pass; (4) there are no critical/high unresolved regressions; and (5) test evidence, dates, device/OS version and reviewer are recorded.

No reviewer sign-off, mobile build deployment, database verification or physical test is asserted here. This document is the reproducible checklist for that sign-off.
