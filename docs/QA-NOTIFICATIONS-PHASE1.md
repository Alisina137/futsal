# Notifications Phase 1 — Delivery & Actionable Events

## Scope
- **Venue owners** now receive a deduplicated BOOKING_REQUEST event after a PENDING online booking has been committed. The notification opens `/owner/schedule`, whose existing `OwnerPendingBookings` panel allows accept/reject. No owner alert is created for an instant CONFIRMED booking.
- **Team managers** receive TEAM_JOIN_REQUEST after a player creates a pending request, linking to `/teams/[teamId]/manage` for review. The **requesting player** receives TEAM_JOIN_DECISION only after manager acceptance/rejection succeeds, opening the team profile. Failed/unauthorized/replayed actions do not cause new alerts.
- English, Dari and Pashto event labels and new message templates; venue booking dates use existing Kabul-local 12-hour formatting in the UI. Existing filters now classify these events under Bookings and Teams.
- Backend **Expo push transport** consumes persisted PENDING deliveries (from `notification_deliveries`) with atomic DB leases across instances, one limited batch per tick and max 3 attempts; transient failures retry after a 120s lease, invalid device tokens are disabled, and disabled push preferences/inactive accounts are skipped. The API starts the worker on boot and polls every 30 seconds.
- Native client enrolls/re-enrolls its Expo push token, registers token changes, responds to notification taps via an allow-listed internal route and unregisters on logout; foreground notification events refresh the unread badge. In-app notifications remain fully available on unsupported clients.
- Migration `0042_notification_action_events` adds three `notification_type` enum members (must apply before updated API). Expo SDK 57 packages are pinned and the `pnpm-lock.yaml` updated. Existing DB schema for push devices/delivery status is reused.
- Run `pnpm verify:notifications-phase1` or full `pnpm verify` for regression tests. `apps/api/test/notification-phase1-push.test.ts` covers actual pending booking dispatch, owner/manager/player isolation, retries, disabled push tokens and deduplication; `apps/api/test/team-join-request-actions.test.ts` checks actual manager/player decision notifications.

## Important build and device prerequisites

**Expo Go does not support remote push notifications on Android in Expo SDK 57.** Futsal's existing `pnpm dev:mobile` (Expo Go tunnel) keeps using the in-app Notification Center, but push needs an **EAS development build or production build** with native `expo-notifications` support. The bridge deliberately skips registration in Expo Go and on web.

To activate **real remote push**, configure the app's EAS project UUID as `expo.extra.eas.projectId` (for example by initializing EAS); configure **FCM v1** credentials for Android and **APNs** credentials for iOS in the EAS project. These keys **must not** be committed to GitHub. Build and install a native dev/production binary that includes the SDK plugin. Grant OS notification permission, sign in, keep Notification Preferences → Push enabled, and verify an Expo push token is registered on the authenticated backend. (For Expo Push Security, optional `EXPO_ACCESS_TOKEN` on the API enables authenticated Expo gateway calls.)

The gateway returns **push tickets**, which show acceptance for downstream delivery, **not guaranteed arrival on the phone**. Device-receipt reconciliation and richer per-device telemetry are possible later extensions. Do not claim native push-device sign-off without actual FCM/APNs/EAS testing.

## Manual cross-role acceptance
1. Sign in as venue owner and player on separate devices. Set the venue booking mode to owner approval; have the player reserve a future slot. The owner should see **New booking requires approval** in Bookings and the owner calendar/pending requests screen. Duplicate booking retries should not send duplicates. An INSTANT booking should notify the player only.
2. As a user, request team membership; the correct team manager should see TEAM_JOIN_REQUEST and reach that team's manage screen. Accept/reject the request; only the requester receives the decision. Other managers and accounts must not see private alerts. Replaying a decision should not create duplicate notifications.
3. Turn Push off, test no remote push is dispatched; turn in-app delivery off, test delivery semantics and note Phase 2 will further align inbox visibility.
4. Verify English, Dari, Pashto messages, RTL icon/card presentation, Kabul date/time (AM/PM), unread counts, refresh and pagination on Android/iOS and web.
5. In a native development build with configured credentials, trigger events while foreground/background/terminated, tap each push and verify authenticated deep links. Temporarily disconnect the API, restore connection, and verify delivery retries do not corrupt the booking or join-request outcome.
6. Review `/admin` delivery health: stalled attempts must transition to SENT, FAILED or SKIPPED; never mark receipt as proof of device notification presentation.

## Local setup
```powershell
cd C:\projects\futsal
git switch main
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev:api
```
Start `pnpm dev:mobile` in the second terminal for in-app testing. Native push tests require an independently installed development build.
