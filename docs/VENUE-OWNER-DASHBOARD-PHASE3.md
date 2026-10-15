# Venue Owner Dashboard Phase 3 — Bookings Management (2026-10-15)

## Scope and delivered implementation

The Venue Owner **Bookings** tab now has four RTL-focused, localized subtabs: **Pending**, **Upcoming**, **All Bookings**, **History**. This preserves the existing independently refreshed, verified pending-approval inbox (including the existing modal approve/reject action), and adds real owner-scoped server-filtered booking lists for confirmed future reservations, complete booking records, and finished/cancelled booking history.

**Upcoming** is strictly confirmed and not yet started, sorted nearest first. **History** consists of cancelled bookings or confirmed bookings whose actual end time is in the past, newest first. **All Bookings** includes pending, confirmed and cancelled items, with a working source/status/customer-or-court search and optional inclusive date bounds; pagination happens **after server filtering**, not on an unbounded client array. Pending requests across any date remain accessible through the pre-existing pending inbox, even where the booking's start time passed and the owner must reject it.

### API and privacy

- Added owner-authenticated **GET /api/v1/owner/bookings** with Zod query contract: `scope=UPCOMING|ALL|HISTORY`, optional `status`, `source`, `q` (max 100 chars), `from`, `to` ISO dates, `page` (1–500) and `pageSize` (5–50), default 20. Server response: `{bookings,page,pageSize,total,hasMore,generatedAt}`.
- The service resolves the requesting owner's own venue and converts date-only bounds in that venue's timezone, before asking the repository for data.
- SQL applies tenant ownership, booking status, source, dates, and escaped text search on customer name/phone and court, before stable sorting, `count`, `LIMIT` and `OFFSET`. Queries cannot enumerate someone else's venue through crafted parameters. The fake repository follows the same scoped filtering rules.
- No new permission to manage arbitrary bookings: pending decisions retain their prior server routes, and future confirmed cancellation is confirmed in a modal then submitted to the pre-existing owner-cancellation endpoint with existing authorization and notification behavior. No fabricated refund logic or payment status is presented.
- Dates displayed in Dari, Pashto, English using the shared formatter and explicit AM/PM.
- Focus refresh, foreground polling, stale-request invalidation, token-scoped data visibility, disabled duplicate writes, and useful empty/error states. All four tabs use the existing owner shell without remounting main navigation.

## Verification

```powershell
pnpm verify:owner-dashboard-phase3
pnpm verify:owner-dashboard-phase2
pnpm verify:owner-dashboard-phase1
pnpm typecheck
pnpm verify
```

- Three integration tests in `apps/api/test/booking.test.ts` cover 19-record pagination, tenant isolation, role protection, upcoming vs history vs all, status/source/search/date filters and invalid inputs.
- Three pure route/date unit tests at `scripts/tests/venue-owner-dashboard-phase3.test.mjs` and a structural/privacy/localization gate `scripts/verify-owner-dashboard-phase3.mjs`. All are in the full `pnpm verify` chain.

## Real device/database sign-off

Before production: validate real PostgreSQL paging with >50 venue reservations; active vs expired pending, approval race, customer cancellation and owner cancellation; deep links to Schedule and return; search with punctuation and Dari/Pashto, one-sided date filters and month boundaries; pagination after mutations; phone data isolation between two venue-owner accounts; English/Dari/Pashto RTL and landscape. Confirm an authorized owner can cancel confirmed future slots, but not manipulate another venue's bookings. Crosscheck state with Calendar and public booking availability.

**Not included:** verified customer payment reconciliation, refund policies, invoice generation or an audit-event stream beyond persisted booking status/cancellation data. Those require separate backend/product decisions.
