# Venue Owner Dashboard — Phase 4: Schedule Operations

Date: 2026-10-15

## Implemented

Venue Owner **Schedule** now has four fully routed, accessible RTL-aware subtabs:

1. **Calendar** — existing Month / Week / Day operations, strengthened with a real venue-API-backed court selector and type filters (All, Available, Online Booking, Manual Booking, Competition, Blocked, Promotion, Closed). Only Week/Day event tiles are filtered: Month's authoritative totals and Day's summary remain unaltered, so filtered tiles can never be misrepresented as financial booking totals. Selecting a court re-fetches the scoped timetable calendar from the existing owner-only API; old actor data is not displayed after token changes.
2. **Weekly Timetable** — existing published/draft/archive and overlapping-reservation conflict checks remain untouched.
3. **Special Schedule** — existing exceptions, holiday hours, duplicate-date protection and booked-slot conflict checks remain untouched.
4. **Blocked Times** — new dedicated bounded 30-day registry using existing `GET /api/v1/owner/timetable-calendar`, supports past/next 30-day windows, creating a new block, editing an existing block, and explicitly confirming before a time is unblocked. Editor can return to the Blocked Times tab after a change. No unbounded client calendar reads.

## Improvements

- **Block editor:** rejects impossible Gregorian dates, malformed times, zero-length/reversed intervals before requests. It performs an advisory same-day preflight against existing online/manual bookings, competition fixtures and other blocks, excluding only the currently edited block ID. This is **not** a replacement for transaction safety: existing `createBlockAtomic` / `updateBlockAtomic` and `SLOT_UNAVAILABLE` errors remain the final source of truth.
- **Safety:** direct Calendar slot actions to cancel an owner booking or unblock a court now require explicit localized confirmation rather than an immediate destructive button.
- **Privacy:** Calendar and blocked registry preserve per-token request identity and active view; previous owner responses are suppressed on focus/blur. The existing API rejects unrelated venue/court scopes. Block actions are server-authorized. Private data is never rendered on another account from the former account cache.
- **Localization/accessibility:** new English, Dari and Pashto translations, 44px Schedule navigation targets, RTL horizontal focus, appropriate readable AM/PM time labels. The repo enforces a *single active court per venue* today; a court selector may show All and the sole existing court, but this phase does **not** introduce unsupported multi-court business entitlement.
- **Data handling:** the Blocked Times listing is limited to a 30-day API range. Navigation can page older/future ranges without pretending all history is loaded.

## Automated verification

```powershell
cd C:\projects\futsal
pnpm verify:owner-dashboard-phase4
pnpm verify:timetable
pnpm verify:owner-week-grid
pnpm typecheck
pnpm verify
```

The new unit suite tests correct time/date validation, nonmutating filter behavior, real blocked occupancy extraction, booking/competition/block overlap logic (including boundaries, edited block and promotions). A static Phase 4 gate checks routes, current server authorization/atomicity, required operations, selected owner scope and all three languages. Legacy timetable verifiers run unchanged.

## Physical-device / database acceptance checklist

1. Expo Go Android, Venue Owner account: navigate to Schedule > Calendar / Weekly Timetable / Special Schedule / Blocked Times with correct main/subtab highlights, including returning from the block editor.
2. Confirm active court name appears from server. Selecting All or Court should only show that court's inventory. Week/Day status filtering must not falsify Month's authoritative booked/available totals.
3. Create a future block from a free slot; verify it appears in Blocked Times and Week/Day Calendar. Edit it and confirm changes. Attempt to overlap a confirmed booking, pending booking, competition fixture or another block: both preflight and definitive API guards must prevent collisions. Confirm block editing itself does not falsely conflict.
4. Attempt invalid, backwards, or equal start/end times; confirm no create/update request is sent.
5. Unblock or cancel a booking from Calendar; verify that a confirmation is required and Cancel leaves existing state intact. Repeat unlink from Blocked Times and verify the block disappears only after success.
6. Sign out or change venue-owner account while request is pending; verify no previous venue's private schedule or block data appears. Test a non-owner deep link to `/owner/blocks`.
7. Check past/future 30-day ranges, network failures/retry and English/Dari/Pashto RTL and date labels. Verify published weekly and Special Schedule conflicts continue to behave as before.

The phase is code/test ready after CI. A real Android device with PostgreSQL data must still pass these checks before production sign-off. No new database migrations or API endpoint changes.
