# Venue Owner Dashboard — Phase 1: Foundation & Navigation

Date: 2026-10-15.

## Implemented

- The Venue Owner role's single `/dashboard` entry now resolves to **`/owner/overview`**, instead of forcing users directly into competition administration. `/owner` redirects to the same entry, and venue-subscription “Open Venue Tools” follows it.
- The persistent owner shell now presents exactly seven RTL-aware, horizontally focusable sections in order: **Overview, Bookings, Schedule, Competitions, Media & Marketing, Analytics, Settings**. Deep owner pages correctly highlight their parent tab. Role entitlement remains authoritative: non-venue-owners are redirected rather than shown management UI.
- The previous duplicate-header `OwnerDashboard` component is reused as a genuine **embedded Overview page**. It shows a translated introduction, real server-backed setup/subscription status, pending booking preview and real links to Bookings, Schedule, Competitions and Analytics; it does not invent financial or occupancy numbers. Phase 2 will supply a richer Today/Action Center/Performance dashboard.
- The Overview status fetch revalidates on focus, invalidates old responses on blur, and only shows venue-private data when the response belongs to the active access token. API failures are shown distinctly from “venue setup required.”
- A standalone **Bookings** destination hosts the existing full `OwnerPendingBookings` inbox, preserving the server's confirm/reject, expiration, actor-scoped polling and concurrency controls. It is a working Phase 1 inbox, **not** a claim that Upcoming, All or History workflows have already been implemented; those belong to Phase 3.
- **Manual Teams** is removed from the main navigation, not deleted. It is accessible via **Competitions > Offline Teams**, next to **All Competitions**. **Posts** and **Promotions** have a similar real functional nested navigation under Media & Marketing. Existing **Calendar / Special Schedule / Weekly Timetable** navigation is preserved. Other inner sections (Analytics, Settings and competition detail management) retain existing tabs.
- The main nav remembers only canonical safe section-level URLs (e.g. Offline Teams, Promotions), not private deep records. Memory resets when the signed-in account changes. Deep links remain supported with accurate parent-tab selection. Translation keys added for English, Dari, Pashto.
- No database migration, package dependency or API signature change.

## Source implementation

`apps/mobile/src/lib/owner-dashboard-navigation.ts`
`apps/mobile/src/components/owner/OwnerTopNav.tsx`
`apps/mobile/src/components/owner/OwnerManagementSubNav.tsx`
`apps/mobile/src/components/owner/OwnerDashboard.tsx`
`apps/mobile/app/(app)/owner/{index,overview,bookings}.tsx`
`apps/mobile/app/(app)/owner/_layout.tsx`
`apps/mobile/app/(app)/dashboard.tsx`
`apps/mobile/app/(app)/role-subscriptions/[role].tsx`
`packages/localization/src/index.ts`

## Verification

```powershell
cd C:\projects\futsal
pnpm verify:owner-dashboard-phase1
pnpm verify:role-dashboard
pnpm verify:role-subscription
pnpm verify:venue-settings
pnpm typecheck
pnpm verify
```

`scripts/tests/venue-owner-dashboard-phase1.test.mjs` covers canonical seven-tab routing, nested routes, safe subtab memory, route prefix boundary handling, and existing management destinations. `scripts/verify-owner-dashboard-phase1.mjs` covers role guards, embedded shell, real booking inbox, private status-scoping, English/Dari/Pashto strings and gate wiring. Relevant old verification scripts were **updated to enforce the new behavior**, not disabled.

## Acceptance scenarios requiring Expo Go

- Owner enters Dashboard from hamburger or paid-role subscription and lands on Overview; one shared header and single owner nav.
- Revisit Overview after changing settings; status refreshes. Disconnect network and verify it displays a retry, **not** a fake “no venue” setup prompt.
- Approve/reject a real pending booking from Bookings, switch to Schedule, and confirm only the authoritative state is reflected.
- Open Offline Teams, switch to another main tab, return to Competitions. It should restore Offline Teams. Repeat with Media > Promotions.
- Open competition-management detail, special timetable and subscription/referees from deep links. Main navigation should highlight Competitions, Schedule and Settings respectively.
- Sign out and change accounts; old data and navigation memory must not appear for the next actor. Non-owner deep link to `/owner/overview` must redirect safely.
- In English/Dari/Pashto, check main and nested horizontal nav focus, readability, screen reader tab selection and 44 px touch targets.

**Scope boundary:** Phase 1 introduces real navigation and a working Overview/booking inbox entry. Business Today KPIs, Action Center, performance panels, booking history, and the remaining new subtabs are planned for subsequent phases. No physical-device sign-off is asserted here.
