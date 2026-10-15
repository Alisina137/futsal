# Venue Owner Dashboard — Phase 7: Analytics & Settings

Date: 2026-10-15.

## Scope delivered

This phase improves the **existing** Analytics and Settings destinations in the seven-tab Venue Owner shell. Existing analytics subviews **Overview / Revenue / Bookings / Customers / Marketing / Competitions** and Settings subviews **General / Booking / Court / Access** remain operational. It does not introduce duplicate backend state or speculative financial endpoints.

### Analytics

- Preserves server-aggregated venue-owner metrics, booked/scheduled capacity, comparison periods, customer totals, booking patterns, discounts, competition information and all six analytics subtabs.
- Current and preset periods use the **Gregorian venue reporting dates in Asia/Kabul**, including correct 7/30/90-day inclusive boundaries.
- Custom dates are checked **before requesting the API**: strict `YYYY-MM-DD`, real dates (including leap years), ordered inclusive bounds, no future dates, and no more than **365 calendar days**. A rejected date does not trigger an unbounded server call or corrupt the previously applied report.
- Reloads on screen focus and app returning to foreground; an explicit Refresh control is available. Request generations invalidate stale responses on blur or when another query starts. Results are displayed only for the **active account access token**, and a mismatched API date range is treated as an error.
- Preset and analytics-section chips announce their selected state through accessibility roles and are 40–42px high; the app's owner main navigation remains 44px.
- A prominently localized disclaimer distinguishes **gross confirmed booking value** from collected cash/net profit. Removed an unsupported "conversion" bar that incorrectly divided *number of promotion bookings* by *number of promotions*, which do not share a valid conversion-rate denominator. The UI explicitly states that this is not views-to-bookings conversion or paid-campaign return.

### Settings

- Preserves and edits authoritative venue contacts, map pin, court duration/price, opening-hours links, booking windows, cancellation policy, rules and amenities. Subscription, venue verification, referees, profile and media remain links to existing managed workflows; no duplicate paid subscriptions or second-court entitlement.
- After editing a field, a localized **Unsaved changes** notice and **Discard edits / Save** actions appear consistently, including when switching to Access. Save is disabled when there is no actual change. Draft detection ignores whitespace-only changes and amenity order while detecting each persisted control.
- Re-entering Settings after opening the timetable, exceptions, referees or subscription **retains unsaved edits** instead of silently overwriting the draft with a fresh GET. Discard restores the latest successfully loaded or saved server state.
- Settings GET/UPDATE responses are request-generation and **access-token scoped**: a delayed response from another owner must not replace the new owner's record. Saving state is also token scoped.
- Changing online booking from enabled to disabled requires an explicit confirmation **before** the update request; the message explains that existing confirmed reservations are not cancelled.
- The API remains the final validation and authorization authority; no database migration or new endpoint is required. The existing single-owner/single-venue subscription entitlement is unchanged.

## Verification

```powershell
cd C:\projects\futsal
pnpm verify:owner-dashboard-phase7
pnpm verify:analysis
pnpm verify:venue-settings
pnpm typecheck
pnpm verify
```

`scripts/tests/venue-owner-dashboard-phase7.test.mjs` exercises invalid/leap/future/inverted/long custom-date ranges and accurate draft-dirty detection for **all editable field types**. `scripts/verify-owner-dashboard-phase7.mjs` enforces authenticated report scope, stale-request safety, true attribution copy, controls and EN/Dari/Pashto translation coverage; it is registered in the root release gate. Legacy analytics verification is updated for the honest attribution label.

## Required physical-device and database acceptance (not yet signed off)

1. Test Analytics on an owner venue with **real PostgreSQL** bookings; check 7, 30, 90-day presets; custom valid leap-day and invalid Feb 30, swapped or future dates; compare displayed numbers with raw authorized records and the previous period.
2. Start slow analytics requests, navigate away and return, switch venue-owner accounts, change date ranges before the previous request finishes, and resume the Expo app after backgrounding. No old actor's statistics or superseded report may appear.
3. Simulate analytics network failure; verify retry, explicit error instead of zero values, and stale-date rejection. Check EN/Dari/Pashto labels, horizontal tab selection, readability and screen readers.
4. Change General phone/map, Booking rules, Court details and amenities; navigate to timetable and back without saving, then Save. Confirm exactly the edits expected, and test Discard across all sections. Test a failed PATCH and unchanged server state.
5. Disable online booking, **cancel** the confirmation (no PATCH), then confirm it (authorized PATCH). Verify new online booking attempts are rejected by existing server rules and past confirmed bookings remain manageable. Turn online booking back on.
6. Start a slow Settings GET/PATCH, sign out and sign in as another venue owner. No private information or success/error from the previous actor should be rendered. Check a narrow Android device, Expo Go modals and RTL behavior.
7. Confirm one account still owns one active venue/court entitlement, subscription Access links do not grant another venue, and server-side role validation remains enforced.

**Release status: not signed off.** CI/local automated verification cannot replace real-device, real-data and role-isolation acceptance. Phase 8 is cross-tab regression and release readiness.
