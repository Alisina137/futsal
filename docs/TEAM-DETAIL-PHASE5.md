# Team Detail — Phase 5: Competitions

Date: 2026-10-15
Scope: Public Team Detail → Competitions → Active / Past. This work follows public profile Phases 1–4; it does not alter the team-manager registration workflow or venue competitions.

## Implementation

- **Truthful public participation:** the public API already limits competition records to **published** competitions with an **ACCEPTED** team registration. New cards explain this as **Confirmed participant**. Invited, pending, rejected, unpublished, and draft competitions do not appear as confirmed entries. The UI never invents a championship title, placement, registration status or prize.
- **Active and Past separation:** active competitions are registration-open/closed, scheduled or in progress. Completed, archived and cancelled competitions are under Past, each with its **actual** localized lifecycle status (e.g., Cancelled is not mislabelled merely “Past”). Inconsistent draft or unknown statuses are rejected from the public list.
- **Relevant ordering:** in-progress first, scheduled by kickoff, then registration states; Past shows most recent completed/cancelled/archived by known end/start date. Date-less items remain visible without invented dates. Sorting is deterministic and does not mutate the API response.
- **Filters per subtab:** dynamic format chips (League, Knockout, Group + Knockout) and lifecycle status chips reflect only the formats/statuses in that subtab. Format and status filters compose; empty filtered results differ from no published competitions. Filter choices persist independently for Active/Past and reset when the team or signed-in account changes.
- **Better cards:** responsive long competition titles, true format and lifecycle badge, confirmed team participation, start and optional end dates in the existing Kabul-local AM/PM format, and a link to both Competition details and Competition → Matches.
- **Relevant published fixture preview:** if present in the public snapshot, a short preview links directly to a genuine match. It prefers a live/next listed fixture, then latest verified completed/corrected result with real scores. Preview explicitly says it comes **only from recent published fixtures**, not an exhaustive history; it never fabricates results.
- **Bounded API transparency:** public highlights contain at most 50 recent accepted competitions and 100 recent fixtures. If the competition list reaches its cap, a localized notice warns that the list may not be complete and links to Competitions discovery. No unaccepted registrations are pulled into the public profile.
- EN/Dari/Pashto translation, RTL focus and accessible selected-state chips preserved. No migration, new server endpoint, subscription change or dependencies.

## Automated verification

```powershell
pnpm verify:team-detail-phase5
pnpm verify:team-detail-phase4
pnpm verify:public-team-detail
pnpm verify:teams-phase5
pnpm typecheck
```

`verify:team-detail-phase5` includes six Node unit tests for lifecycle classification, active/past sort, combined filters, dynamic chips, unrelated-team fixture rejection, and verified-score preview, plus source regression guards for the existing published/accepted server gates. It is part of the repository-wide `pnpm verify` check.

## Remaining manual Android / API acceptance

| Scenario | Expected |
| --- | --- |
| Published competition with ACCEPTED registration | Appears with Confirmed participant, correct format and real lifecycle status |
| INVITED/PENDING/REJECTED team registration or unpublished competition | Never leaks into public competitions |
| Live, scheduled, registration-open, registration-closed competitions | Correct Active statuses and priority |
| Completed, archived, cancelled competition | Correct Past status and newest-known order |
| Several competitions of different formats | Status and format chips filter accurately and separately on Active vs Past |
| Missing dates, unusually long competition name | Correct fallback, no fabricated date, no text overlap |
| One public match vs private/unpublished matches | Preview only links to public recorded fixture, shows accurate stage/date/score |
| Direct competition and Matches buttons | Opens real Competition detail and Matches tab, respectively |
| More than 50 published accepted competitions | Limited-history notice is shown, no claim of exhaustive history |
| Switch tabs or teams/accounts mid-request | Previous team filters and any old fixture preview do not leak |
| Dari/Pashto / narrow Android / font scaling | RTL direction, horizontally visible chips, accessible labels, no clipping |
| Offline / retry / refresh | Existing public-highlights retry works with no stale private data |

CI cannot validate Android hardware layout or production backend data. Those checks remain manual and are not claimed complete.
