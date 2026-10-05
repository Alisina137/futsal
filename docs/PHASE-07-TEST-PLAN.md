# Phase 7 Test Plan — Subscription Enforcement, Analytics and Admin

## Goal

Verify that the commercial SaaS loop is enforceable and measurable without breaking continuity for existing venue operations.

## Automated gate

Run:

```powershell
pnpm verify
```

The Phase 7-specific invariant gate is:

```powershell
pnpm verify:phase7
```

## 7.1 Subscription expiry and continuity

1. Start with an owner whose trial or paid subscription is active.
2. Confirm public availability and Premium owner writes work.
3. Move the server clock/data past the entitlement end timestamp.
4. Confirm owner subscription state becomes `EXPIRED` and access mode is `CONTINUITY`.
5. Confirm new online availability is not bookable.
6. Confirm new manual bookings, blocks, promotions and competition writes are rejected with `SUBSCRIPTION_REQUIRED`.
7. Confirm the owner can still open the schedule and service/cancel existing bookings.
8. Reactivate the venue from the platform-admin flow.
9. Confirm Premium writes return without deleting venue, booking, promotion, team or competition data.

## 7.2 Billing activation and payment history

1. Open Owner → Subscription.
2. Confirm current subscription state, venue verification state, plan price and trial duration are visible.
3. On an expired venue, request reactivation and confirm the request succeeds without granting entitlement by itself.
4. Sign in as a `PLATFORM_ADMIN`.
5. Record a one-month manual activation with amount and provider reference.
6. Confirm the venue becomes `ACTIVE` unless it is separately suspended.
7. Confirm the payment appears in Owner → Subscription with amount, period, provider reference and `RECORDED` state.
8. Attempt the same non-empty provider reference twice and confirm the duplicate is rejected.
9. Void a payment record with a reason and confirm it becomes `VOIDED` without silently rewriting historical entitlement periods.

## 7.3 Owner analytics

1. Open Owner → Analytics.
2. Test a date range with no bookings and confirm only the explanatory empty state appears.
3. Test a date range with online and manual bookings.
4. Confirm:
   - total booking count,
   - confirmed count,
   - cancelled count,
   - online/manual split,
   - online-booking share,
   - booked minutes/hours,
   - available venue minutes/hours,
   - occupancy rate,
   - booking GMV estimate.
5. Confirm cancelled bookings do not contribute to booked minutes or GMV.
6. Confirm date ranges longer than 366 days are rejected.
7. Confirm analytics remain readable in continuity mode.

## 7.4 Platform admin core

1. Confirm a non-admin token receives `403 ROLE_REQUIRED` for `/api/v1/admin/*`.
2. Confirm a `PLATFORM_ADMIN` can open the admin console.
3. Search users by name/phone/username.
4. Suspend a user with a reason.
5. Confirm active refresh sessions are revoked.
6. Restore the user.
7. Search venues by name/city/address.
8. Verify a venue and confirm verification state becomes `VERIFIED`.
9. Reject verification with a reason and confirm state becomes `REJECTED`.
10. Suspend a venue with future bookings.
11. Confirm the venue is no longer publicly bookable and Premium writes are blocked.
12. Confirm existing bookings remain available to the owner.
13. Restore the venue.
14. Review the duplicate-venue groups response.

## 7.5 Trial, configuration, moderation and audit

1. Extend an expired trial by a specified number of hours.
2. Confirm an active paid subscription cannot be replaced by a trial extension.
3. Change monthly price, annual price and trial duration in Platform Configuration.
4. Start a new venue trial after the change and confirm the configured duration is used.
5. Confirm feature flags and notification-template configuration are preserved when price/trial settings are updated.
6. Add a support note against a user and a venue.
7. Unpublish a venue post with a moderation reason.
8. Close an active promotion with a moderation reason.
9. Open Audit Log and confirm privileged actions include actor, target, timestamp and metadata/reason.
10. Confirm admins cannot suspend their own current admin account.

## Localization and RTL

For Dari, Pashto and English:

1. Open Owner Subscription.
2. Open Owner Analytics.
3. Open Platform Administration.
4. Confirm labels exist with no raw localization keys.
5. Confirm Dari/Pashto action rows and form order follow RTL.
6. Confirm IDs, phone numbers, AFN amounts and provider references remain readable in LTR where appropriate.

## Migration

After pulling the integrated Phase 7 branch:

```powershell
pnpm db:migrate
```

Expected migration:

`0006_phase7_commercial_core.sql`

It adds venue verification state, subscription-payment history and platform configuration. Do not run `pnpm db:generate` before applying this committed canonical migration.

## Status rule

Do not mark Phase 7 fully verified until:

- `pnpm verify` is green,
- `pnpm db:migrate` succeeds,
- continuity/reactivation is exercised,
- owner analytics is checked with real booking data,
- at least one platform-admin venue verification/suspension/subscription activation flow passes on the live API/mobile environment.
