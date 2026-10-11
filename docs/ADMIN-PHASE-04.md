# Futsal Admin Completion — Phase 4 / 7

Status: implemented on `main`, production rollout gated by applying database migration and manual staging integration.

## 4.1 — Venue directory and detail
- Search/name, location, date, venue ID, operational status and verification status filtering. One server-scoped page at a time (10–100 bounded entries; UI 25), server totals and deterministic sorting.
- Detail includes owner, address/geo, subscription status and term, court count, timetables, recent bookings and venue referees. Identifies violations of **one owner = one venue = one active court**; no silent automatic repairs.
- Original venue billing and subscription controls remain unchanged in their separate area.

## 4.2 — Verification and duplicate review
- Venue verification queue uses verification-status PENDING. Approve/reject and suspend/restore require a reason and shared confirmation dialog. Database update and audit entry now commit transactionally with row-locking, no-op state transitions refused.
- Duplicate inspection groups normalized name, city and address; never merges or deletes venues. The duplicate review worklist is bounded.

## 4.3 — Team monitoring
- New Team directory and detail: manager, privacy/status, membership roster, manager subscription snapshot and competition registrations. Original manual-team claiming remains in its own authorized workflow; this console never grants access for free or bypasses extra-team entitlements.

## 4.4 — Competitions
- New competitions directory and detail: venue and organizer, format, schedule, registrations, fixture status and scored match summaries. Warnings for oversubscription, in-progress yet unscheduled games, or completed games missing scores.
- Authorized intervention is an audited investigation case with reason and narrative; direct forced rewriting of official competition state/results is **not** enabled in Phase 4.

## 4.5 — Referees
- Directory covers venue-assigned referees and old explicit grants. Detail shows assignments, matches and exclusivity warnings for player profiles, team memberships/management, venue ownership and other roles.
- Venue Owner remains the only authorized referee assignment flow, and candidates must be role-free Normal Users with no player/owner/team/subscription conflicts.

## 4.6 — Global reservations
- Global searchable, paginated reservation directory with venue ID, status, source, AFN price, Afghanistan-local date ranges and customer/booking detail for platform administrators only. Server identifies overlapping CONFIRMED reservations on the same court.
- No admin endpoint can silently overwrite a booking or past confirmation. Disputes and suspected duplication are managed in independently persisted `admin_cases`.

## Investigation lifecycle
- Migration `0034_admin_operations_cases.sql` creates cases with state OPEN / UNDER_REVIEW / RESOLVED and a unique index permitting at most one unresolved case per target; resolved cases cannot be rewritten.
- POST /api/v1/admin/cases and PATCH /api/v1/admin/cases/:id require nontrivial reason and note; source record must exist. Each insert/change is audit-recorded in the same transaction, the original match/booking/role remains untouched.
- Routes GET /api/v1/admin/operations/:kind, /:kind/:id and /:kind/:id/cases, /operations/venues/duplicates and /cases are protected by live revalidation of PLATFORM_ADMIN.
- Dedicated Investigation navigation supports workflow, filtering and follow-up. Cancellable section-scoped loads prevent stale result flashes.

## Validation and release gates
- `pnpm db:migrate` before API restart, `pnpm verify:admin-phase4`, `pnpm verify`; GitHub CI also exports the Expo web bundle.
- Manual staging: large (100+) directories, pending verification statuses, concurrent approve/reject, duplicate case conflicts, account/role revocations, one-court historical anomalies, competition progress, referee conflict screens, cancellation/overlap cases and EN/fa-AF/ps-AF RTL desktop/mobile layouts.
- No direct bookings/matches deletions, referee grants, match score overrides, subscription shortcuts or duplicate merges were introduced.
