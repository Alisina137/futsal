# Venue Owner Dashboard — Phase 2: Operational Overview

Implementation date: 2026-10-15.

## Delivered

**Overview** (existing `/owner/overview` in the persistent owner shell) now has three localized, scroll-focused subtabs: **Today**, **Action Center**, **Performance**. First visit defaults to Today; tab selection is reset on account change. No second header or owner navigation is mounted.

### Today
- Server-authoritative venue calendar, all-date pending booking inbox, owner competition list and venue analytics are read using the signed-in account's token. The date is the current **Asia/Kabul** day, not device UTC. The analytics window is that date and six prior calendar days.
- KPI cards: confirmed bookings today, pending future booking requests (all dates), remaining future bookable slots today (including active promotion slot events), confirmed booking **value** (not cash), active competitions, and remaining matches on today's calendar.
- Calendar items are sorted ascending, with a localized venue/court name and explicit AM/PM start time. Only future confirmed bookings or competition events appear. Selecting a calendar item opens the day view.
- Fast links remain available for Bookings, Schedule, Competitions and Analytics. Important actionable items have a direct Action Center shortcut.

### Action Center
- Future pending approvals → **Bookings** (approval/rejection remains in the existing authoritative component).
- Subscription expired/cancelled/within 7 days of deadline → **Subscription**.
- Online bookings disabled → **Venue Settings**.
- Open competition registration windows → **Competitions**. Note: this is **not** an inferred count of pending team registrations; no such count exists on the owner competition-list contract yet.
- Truly empty queues show a clean all-caught-up state. If a source was unavailable, the UI shows an unknown/retry state rather than claiming a queue is empty.

### Performance
- Venue-scoped 7-day analytics source: **gross booking value (GMV-like, not verified collected money)**, booking count, occupancy, cancellation rate, share booked online, comparison with the preceding equivalent period.
- Figures and percentages come from the existing `/api/v1/owner/analytics` contract. No client-side redefinition of revenue or alternate monetary backend.
- A full analytics shortcut deep-links to the separate Analytics tab.

## Data integrity and resilience

- The owner setup/subscription read is the essential gate. Without a venue, only setup instructions show; a failed status read displays an error/retry and never pretends the venue was unconfigured.
- Once setup exists, calendar, pending bookings, competitions and analytics requests use **`Promise.allSettled`**; one failure does not hide unrelated healthy sections. Failed data is represented by `null`, displayed as unavailable/dash rather than zero.
- Actor-scoped credentials and generation guards suppress stale replies after a dashboard focus change, actor change, date turnover, or a newer refresh.
- Focus reload and 60-second active-foreground refresh keep operational counts reasonably current. Pull to refresh is supported.
- Calendar day matching and future-slot comparisons use timestamps, not naive device-local time. Past available slots are never counted as still bookable; tentative and cancelled bookings do not count as confirmed.
- Server status and access controls remain enforced at owner route and API layers. Summary data is intentionally **view-only**; booking decisions and other writes still happen in existing management routes.
- English, Dari and Pashto translations, RTL subtab direction, horizontally focused tabs, 44px minimum touch targets, accessible labels and selection state are included.

## Test commands

```powershell
cd C:\projects\futsal
pnpm verify:owner-dashboard-phase2
pnpm verify:owner-dashboard-phase1
pnpm typecheck
pnpm verify
```

`scripts/tests/venue-owner-dashboard-phase2.test.mjs` covers confirmed/manual/pending/cancelled booking correctness, remaining slots vs expired inventory, duplicates, mismatched Kabul date, independent unavailable sources, priority actions, trial expiration, period comparison and safe unknown values. `scripts/verify-owner-dashboard-phase2.mjs` checks requests, roles, partial failure, refresh, dashboard/tab accessibility, financial language and three locales. The old Phase 1 gate now asserts snapshot reuse rather than duplicating pending inbox fetch.

## Follow-up

- Phase 3 builds full **Bookings > Pending / Upcoming / All / History** subtabs, search, pagination and operational history.
- Phase 4 improves court filtering and deeper timetable control.
- An Android Expo Go sign-off with real PostgreSQL records is still required. Validate all three languages, near-midnight Kabul date, real pending and confirmed bookings, varying competition status, expired subscription, loss of one API dependency, foreground refresh, sign-out and account-switch isolation. Neither a browser export nor unit tests substitute for these checks.
