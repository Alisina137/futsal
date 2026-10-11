# Futsal Admin Panel — Phase 5: Subscriptions, Payments & Financial Controls

**Implemented on main.** Migration 0035 is required before starting the new API.

## Features
1. **Finance dashboard:** manual recorded receipt totals and voided amounts by Venue, Paid Role (Venue Owner or Team Manager), Extra Team; reports are NOT bank-confirmed cash and booking GMV is never included. Pending paid roles / extra team approvals and active venue/role/extra entitlements expiring within 7 days are separate attention KPIs.
2. **Server-paged payment ledger:** GET `/api/v1/admin/billing/receipts` with bounded page/pageSize, kind/status, search by customer name/reference/target ID, and date range using Kabul-local date boundaries. GET `/api/v1/admin/billing/summary` returns totals for the selected period (not narrowed by kind/status). All endpoints require live PLATFORM_ADMIN authorization.
3. **Role/extra receipts:** New `paid_entitlement_payments` records created with role or extra-team activation atomically, including months, plan amount, interval, actor and payment reference. The first Team Manager team is covered by the paid base role; additional teams require independent paid slots.
4. **Cross-stream payment references:** All new activation workflows require a nonempty receipt reference and reject references already recorded for any of the three streams; a shared advisory lock prevents concurrent reuse across tables. Historical venue receipts stay in the existing `subscription_payments` ledger.
5. **Audited voids:** Existing venue voids now row-lock the record, reject already-voided updates and atomically write an audit record with reason. Paid role/extra receipt voids are similarly audited by POST `/api/v1/admin/billing/paid-receipts/:id/void`. Financial corrections **do not silently revoke existing entitlements**, requiring separate administrative review.
6. **UI:** Overview metrics, paged receipt history, status/type/date/search filters, local date presentation, audited void confirmation with required reason, explicit role receipt reference validation, and explicit extra-team payment confirmation. Localized English/Dari/Pashto primary finance copy.

## Boundaries / follow-up
- No automatic bank/payment-gateway reconciliation or false claim of confirmed settlement.
- No fabricated historical paid-role or extra-team revenue: ledger coverage starts at Phase 5 activation. Use original audit records for pre-Phase-5 investigation, not as cash proof.
- Existing manual subscriptions and team-slot provisioning controls remain accessible and authoritative; no new free-team or multi-court loopholes.
- Financial ledger void does not itself cancel paid role or venue service; separate access review may be needed.
- Verify via `pnpm db:migrate`, `pnpm verify:admin-phase5`, `pnpm verify` and manual concurrent reference, audit and RTL QA in staging. Migration should be applied before starting the updated server.

## API
- GET /api/v1/admin/billing/receipts
- GET /api/v1/admin/billing/summary
- POST /api/v1/admin/billing/paid-receipts/:id/void
- Existing venue and paid-role admin activation and team-slot approval endpoints remain, with stronger reference requirements.
