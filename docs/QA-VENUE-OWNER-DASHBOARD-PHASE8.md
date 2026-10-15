# Venue Owner Dashboard — Phase 8: Cross-tab Regression & Release Readiness

Date: 2026-10-15.

## Scope and source of truth

This is the final **automated regression and integration-hardening** phase for the Venue Owner Dashboard. It covers the seven owner sections (**Overview, Bookings, Schedule, Competitions, Media & Marketing, Analytics, Settings**), their existing working subtabs, the persistent RTL navigation shell, real role/tenant authorization, and background/foreground/stale request safety.

Preserved product policy: one owner role and its current authorized venue; existing court entitlement; existing subscription payment rules. No new subscription, payment collection, refund, owner review replies, competition stats, ad ROI or parallel booking state is invented.

### Corrections made during the cross-tab audit

1. **Role and session shell:** Owner screens no longer mount while auth/session is absent during hydration; normal and non-owner sessions are redirected by the existing role guard. One persistent header and owner main navigation remain.
2. **Schedule:** A previously loaded calendar is now usable only when its **access token, court, Day/Week/Month view, selected date and date-window** still equal the current selection. API `from`, `to` and `areaId` are checked against the requested values before accepting a response. Changing court no longer silently renders the prior court's events; a failed initial load presents an actionable error/retry rather than an endless loading skeleton.
3. **Schedule write safety:** Sign-out/switch-owner invalidates selected slot and cancellation/unblock confirmations, including immediate token-sensitive visibility; completing an earlier booking/block action cannot refresh another owner's calendar or overwrite the current owner's error/busy status. Server-side authorization and atomic occupancy/booking rules remain authoritative.
4. **Posts and public media editing:** Outstanding publish/unpublish/delete/visibility/schedule cancellation and public profile write callbacks now test the initiating account token before updating lists, profile cards, counts, errors, or loading state. Previously fetched media lists and their optional profile still have independent failure handling.
5. **Promotions:** Closing an offer and displaying its confirmation modal is now tied to the currently authenticated owner, not a stale closure-captured token. Past-owner completion cannot produce a success/error notice on the next account.
6. **Offline Teams:** Create/edit submission, busy state, form reset and success/error messages are scoped to the initiating owner to avoid stale UI writes after switching accounts. Team and registration permissions remain in the original backend.

### Automated checks

- `scripts/tests/venue-owner-dashboard-phase8.test.mjs`: every canonical section, operational deep links, exact allowed main/sub-navigation destination memory, malicious-looking route prefix boundaries, Day/Week/Month calendar court/user/date/view/window selection invariants, and date validation for booking/analytics.
- `scripts/verify-owner-dashboard-phase8.mjs`: checks real source pathways for **seven sections**, navigation/role guards, query-scoped booking and schedule data, actor-safe cross-tab writes, server role and venue isolation, trilingual labels, test registration and release-gate wiring.
- Existing Phase 1–7, booking, venue settings, analytics, competition, media, timetables, API and other app regressions remain in `pnpm verify`. Phase 4/6 structural gates were **strengthened** for the newly fixed safety behaviors, not removed.

```powershell
cd C:\projects\futsal
pnpm verify:owner-dashboard-phase8
pnpm verify:owner-dashboard-phase4
pnpm verify:owner-dashboard-phase6
pnpm verify:owner-dashboard-phase7
pnpm typecheck
pnpm verify
```

## Device and real-database acceptance matrix — still required

### A. Navigation and role boundaries

1. As a valid owner, open `/dashboard` and verify Overview default, one app header, exactly seven main tabs, RTL focus/scroll and active item in English, Dari and Pashto.
2. Test every main tab and relevant subtab: Overview Today/Action Center/Performance; Bookings Pending/Upcoming/All/History; Schedule Calendar/Weekly Timetable/Special Schedule/Blocked Times; Competitions All/Offline Teams; Media Posts/Promotions/Public Profile/Reviews; Analytics Overview/Revenue/Bookings/Customers/Marketing/Competitions; Settings General/Booking/Court/Access.
3. From nested edit/creation routes, ensure the correct parent tab highlights and that returning to a main tab does not navigate into a private post/fixture ID or unsaved draft.
4. Change account, refresh an access token, sign out, revoke owner role or open an owner deep link as an ordinary player, team manager or referee. Verify no private owner data/cards and no unauthorized write.
5. Test Android back button, narrow phone, landscape/tablet, tablet side margins, and touch accessibility with TalkBack and keyboard focus.

### B. Operational cross-tab workflows

6. Create a booking from an eligible real venue slot; verify Overview Today, Bookings Upcoming/All and Schedule show the same state after navigation and focus reload.
7. In approval mode, confirm/reject pending reservations from **Bookings** and from **Schedule**. Ensure all surfaces reflect final server status; no duplicate approval or double count.
8. Cancel a confirmed future booking. Check explicit confirmation, server authorization, disappearance from Upcoming, appearance in History and freed inventory in Schedule. Do not represent cancellation as a refund.
9. Create/edit/remove a time block, change court/date/view/status filters and verify only the correct court is displayed. A booking or fixture must never be silently overwritten by a conflicting block.
10. Change weekly timetable/special-date closure/pricing, publish, return to Schedule and verify availability matches venue-local dates and published settings.
11. Create a competition, register offline teams as permitted, approve real applications, assign fixtures and navigate back from organizer tabs. The Competitions directory and real scheduled matches must match; no invented registration count.
12. Create a post and future/current offer, change visibility or schedule, check Media public profile/reviews, return to posts and ensure no stale counts or wrong public visibility.
13. Modify Booking and Court Settings, temporarily pause online bookings, verify that new requests are refused while existing confirmed bookings and owner operations remain available. Cancel a pause confirmation and ensure nothing changes.
14. Check Analytics gross booking value, competition hours, booking counts and cancellation totals after actual changes, noting the aggregation period and normal refresh delay. Distinguish booked value from collected cash and marketing attribution from ad-conversion speculation.

### C. Data isolation and resilience

15. Use two genuinely independent venue-owner accounts with separate venues. Alternate accounts **while each of the following is in flight**: Overview summary, Bookings directory/decision, Schedule load/cancel/unblock, Competitions owner list, Posts media load/publish/edit, Promotions close, Offline Teams save, Reviews paging, Analytics load and Settings PATCH.
16. During each account transition, old requests and modals must not render old customer names, schedules, venue media/profile, booked values or old action results. A server-side permission failure must remain visible as an error, not empty success data.
17. While loading Schedule court A, switch to court B, then date or Week view, and allow responses to arrive out of order; only the latest exact selection can render. Repeat after dropping the network and using Retry.
18. Exercise slow 3G/mobile network, request timeouts, offline/reconnect, app background/foreground and forced stale responses; observe loading, error and explicit retry, not false empty lists or reconnect loops.
19. Test all date boundaries: midnight Kabul, a leap year (2028-02-29), invalid 2026-02-29 and 2026-02-30, daylight transitions in any configured venue timezone, cross-month Week, and year-end.
20. Test all four Settings sections with unsaved edits when switching tabs, returning from linked managers, discarding, failed PATCH, successful PATCH and app logout.
21. Confirm real PostgreSQL tenant filtering on GET and POST/PATCH: owner A cannot load/update/cancel/block owner B's venue, booking, public-page media, competition, or offer using B's IDs.
22. Audit accessibility and layout for large text, voice screen readers, 44px controls, RTL chip focusing, keyboard avoidance and translations.

### D. Release sign-off evidence

Record for each acceptance case: tester, date, account role, venue/court or test fixture, app build, API commit, actual vs expected, pass/fail, screenshots/logs (redacted), and linked issue for any failure.

**Status:** The source-level and automated checks can pass in GitHub Actions, but that alone does **not** approve a production release. Independent real Android/Expo Go tests, live PostgreSQL integration checks, verified backup/rollback and human sign-off are still required.
