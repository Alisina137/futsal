# Notifications Phase 2 — Reliability, live badge, preferences, and routes

## Shipped behavior
- **Channel isolation:** inbox, filters, and unread badges include only notifications with an actual `IN_APP` delivery. Events published while in-app notifications were off (but native push was on) remain push-only and do not silently reappear as in-app unread entries. Existing in-app notifications persist when users later disable delivery. Directly dispatched admin notices already create an `IN_APP` delivery. No schema change.
- **Live counters:** a small authenticated `GET /api/v1/notifications/unread-count` endpoint avoids loading the first page for badge refresh. App top nav refreshes on focus, foreground, and a 30-second active-session interval; offline fetch failures retain the previous server count instead of resetting to zero. Native push bridge revalidates using the same endpoint.
- **Server-authoritative actions:** `POST /:id/read` now returns `{notification,unreadCount}`, and repeat read requests preserve original read timestamps. Inbox mutations use server totals rather than decrementing a closed-over count.
- **Keyset pagination:** `GET /api/v1/notifications?filter=ALL&limit=30&cursor=...` uses descending `createdAt,id` order and an opaque base64url timestamp/UUID boundary. A freshly published notification ahead of page one cannot displace older rows and skip entries. Response adds `nextCursor`. Legacy `offset` remains supported for compatibility, but sending both `offset` and `cursor` is rejected. Malformed cursors fail validation; user ownership checks remain mandatory. The inbox preserves loaded rows on Load-more network failures and shows Retry.
- **Stale-response prevention:** notification list reads bypass the 10-second read cache; the screen and navbar use generation guards so filter/role changes and mutation results win over prior requests. In-flight errors do not replace a populated older page with an empty offline banner. Pull-to-refresh and app resume are supported.
- **Better destinations:** booking confirmations/cancellations highlight and expand the specific reservation; owner approval notifications highlight pending booking; join requests highlight the manager's request; friendly challenges open the matching team manager's Matches tab, highlighting the exact challenge; ordinary platform announcement notices expand in place instead of sending users incorrectly to Support. Moderation warnings continue linking to Support.
- Preserved English/Dari/Pashto translations, physical layout and existing six filters.

## Automated verification
- `pnpm verify:notifications-phase2` covers required API/contract/client invariants and screens.
- `apps/api/test/notification-phase2-reliability.test.ts` verifies same-timestamp keyset pagination, new rows between pages, push-only privacy, per-user isolation, forged cursor rejection, idempotent marks and unread counts.
- Existing Phase 1 and Notifications Center scripts updated for parameterized deep links.
- Full CI `pnpm verify` and Expo web export on PR; competition database smoke remains independently enforced.

## Device/manual acceptance checklist
1. User A receives 65+ mixed events across Bookings/Teams/Competitions. Load multiple pages; have another device send two newer events while paging. Confirm no duplicate/missing cards and filters show correct totals.
2. Mark multiple items rapidly, mark all, clear read and delete items while switching category. The list and top bar badge must match the server's `unread-count`. Repeat marking an already-read item and confirm the original timestamp is retained.
3. Disable in-app delivery but leave Push enabled on a registered native handset. Send a new booking event. Push may be delivered, but the app inbox does not show it; after toggling in-app back on, **only future** events become in-app notifications. (All older in-app notices remain visible.) Test both channels off as well.
4. Suspend account / sign out / change user and verify no cross-account notifications or badges. Simulate network outage while the badge is nonzero; the badge should retain its last verified state instead of becoming fabricated zero.
5. Put app in background, send an event, return. Confirm refresh on foreground. While on Notifications, use pull-to-refresh. During Load more, simulate offline and press Retry: existing cards should remain visible.
6. Tap owner approval, booking confirmation, team join request, join decision, and challenge. Confirm exact relevant card is highlighted and appropriate actions remain role-protected. Ordinary admin announcement should expand to show complete body, while moderation notices route to Support.
7. Test English, Dari, Pashto, physical RTL, Android/web, small phone, and screen-reader labels. Native push still requires EAS project ID, FCM/APNs credentials and a standalone development/production build; Expo Go supports in-app only.

## Migrations
**No Phase 2 database migration**. Phase 1 migration `0042_notification_action_events` must already be applied before running the latest API.
