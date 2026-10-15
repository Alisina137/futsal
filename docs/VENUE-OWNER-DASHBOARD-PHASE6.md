# Venue Owner Dashboard — Phase 6: Media & Marketing

Implemented: 2026-10-15.

## Scope

**Media & Marketing** now contains four real, owner-shell subtabs:
1. **Posts** — Existing publishing, draft scheduling, visibility, content media, and venue post workflows are preserved. Added owner-visible text search, clearly selected accessible 44px filters and independent `Promise.allSettled` loads for posts and optional venue profile. An optional profile error cannot destroy a healthy post inbox; a posts error is never treated as an empty directory. Results are token-scoped, and stale focus responses are ignored.
2. **Promotions** — Five lifecycle views: All, Active, Upcoming, Expired, Closed with genuine filtering, text search, counts, sorting and read-only history. Stored promotion statuses remain **ACTIVE / EXPIRED / CLOSED**; **Upcoming** is a derived display state when an ACTIVE promotion has not started, and a past-end ACTIVE offer appears expired. Closing a promotion requires explicit confirmation and reuses existing server-authorized close API. Revisit/foreground refresh and token guards prevent retaining another owner's cards.
3. **Public Profile** — A dedicated editable venue-public-profile management page, separate from Posts. It displays the existing owner-scoped media page and enables updating the persisted cover photo, profile image, and bio through the authoritative media image picker/upload and media-page update API. A preview link opens the actual public Venue page. Names, contact address, price or booking policies remain governed by **Settings**, not an alternative profile configuration source. Legacy profile controls embedded in Posts remain usable for compatibility.
4. **Reviews** — Real verified public customer reviews and 5-star distribution for the authenticated owner's own venue. A venue ID is resolved from the current owner token via `ownerApi.getStatus` before calling the existing public reviews API. Pagination (one page at a time), recent/highest/lowest sorts and error/retry are supported. **Reviews are read-only**: no owner replies, fabricated reviewer identity or unsupported moderation controls are exposed.

## Data & safety decisions

- No fabricated ad reach, conversion or paid-campaign ROI. Promotion status and counts reflect saved offer data, not actual paid bookings or revenue.
- No cross-tenant editing: profile media and promotion writes use the server's existing VENUE_OWNER authorization. Reviews read only public verified content and derive venue ID from the authenticated owner account; never accept an arbitrary ID as an owner review scope.
- Individual source failure is represented as unavailable/error rather than a misleading empty business state.
- Account-safe reads use token-scoped snapshots and focus response generations. The top-level marketing navigation remembers only four known canonical route destinations, never post IDs or draft URLs.
- Post authoring and scheduling validations, backend moderation, storage and notification paths remain unchanged; no new migration, endpoint or dependency.
- English, Dari and Pashto localization and RTL, accessible selection and 44px targets apply to new subtabs and controls.

## Regression and test commands

```powershell
cd C:\projects\futsal
pnpm verify:owner-dashboard-phase6
pnpm verify:media
pnpm verify:owner-dashboard-phase1
pnpm typecheck
pnpm verify
```

The unit suite `scripts/tests/venue-owner-dashboard-phase6.test.mjs` covers time-derived lifecycle correctness, status exclusivity, counters, newest/upcoming ordering, search, post schedule filtering, privacy, exact tab navigation, and safe route memory. `scripts/verify-owner-dashboard-phase6.mjs` checks the actual media/profile/reviews API use, actor isolation, accessible views, and all three language dictionaries; it is included in global `pnpm verify`.

## Expo Go and PostgreSQL sign-off still required

1. Test two signed-in owners with different venues; switch accounts while posts/profile/promotions/reviews requests are in flight. Do not display the previous owner's private content.
2. Create/publish/unpublish/schedule posts; verify scheduled vs draft vs public/private and text search. Simulate the media profile endpoint failing while posts still load; test reverse failure.
3. Create an ACTIVE future promotion (should be Upcoming), currently-valid promotion (Active), expired time-range offer and closed offer. Test counts, state changes as time passes, filters/search and close confirmation. Cancellation must not affect existing bookings.
4. Upload a profile image, cover image and edit a bio; open public preview and confirm persistence across re-login. Return to Posts and verify the new image. Settings remains source of truth for venue contact/details.
5. Review a venue with verified review records and a venue with no feedback; test counts/distribution, sorts, pagination and RTL. Confirm there is no unsupported “reply” action.
6. Test offline/retry, dark and narrow devices, screen readers, Android back navigation, English/Dari/Pashto tabs.

**No production sign-off** is claimed until device and real database checks pass. **Next: Phase 7 — Analytics & Settings**, then Phase 8 regression/release readiness.
