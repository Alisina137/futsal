# Phase 4 Test Plan — Promotions, Feed and Notifications

Run this plan only after the Phase 4 migration and `pnpm verify` succeed.

## Preconditions

- API and mobile app are running.
- A Venue Owner has a completed venue with an active Trial or Active subscription.
- The venue has at least one future available slot.
- At least one Player account exists.
- The Player can reach the API from the physical Android device.

## 4.1 Follow / unfollow

1. Sign in as a Player.
2. Open an active venue.
3. Tap **Follow venue**.
4. Confirm the follower count increases.
5. Open Feed → Following.
6. Unfollow the venue and confirm the state/count update.

Expected:
- repeated follow calls do not create duplicate follows;
- another user's follow state is unaffected;
- only public venue information is exposed.

## 4.2 Create a real-slot promotion

1. Sign in as the Venue Owner.
2. Open Dashboard → Promotions → Create promotion.
3. Choose a future date.
4. Select one live available slot.
5. Enter a price below the current AFN price.
6. Enable follower notification.
7. Publish.

Expected:
- only a real currently available slot can be selected;
- equal/higher prices are rejected;
- one active promotion exists for the exact slot;
- owner promotion list shows ACTIVE.

## 4.3 Promotion appears in availability and Feed

1. As a Player, refresh Feed.
2. Open the promotion.
3. Confirm the venue availability date opens.
4. Confirm the promoted slot shows:
   - discounted AFN price,
   - original AFN price,
   - discounted-slot indicator.

Expected:
- the promotion CTA lands on the correct venue/slot;
- the live slot price is the server promotion price.

## 4.4 Book the promoted slot

1. Book the promoted slot as the Player.
2. Open My Bookings.
3. Open the owner Schedule.
4. Refresh Feed and venue availability.

Expected:
- booking confirmation price equals the discounted server price;
- the booking occupies the normal shared calendar;
- promotion automatically closes with no separate owner action;
- the promotion disappears from public Feed/live availability;
- cancellation later does not automatically resurrect the old promotion.

## 4.5 Block or expire promoted inventory

Block path:
1. Create another promotion.
2. Owner blocks the same interval.

Expiry path:
1. Use a short/future controlled promotion interval or test clock.
2. Advance beyond its end.

Expected:
- block closes the promotion automatically;
- expired interval becomes EXPIRED;
- inactive offer cannot be opened as an active promotion.

## 4.6 Venue posts and structured CTA

1. Owner opens Posts → Create post.
2. Publish a text-only post with Venue CTA.
3. Confirm it appears in Feed.
4. Open it and use the CTA.
5. Create another post linked to an active promotion.
6. Unpublish it and confirm it disappears from public access.
7. Re-publish only while the promotion is still active.

Expected:
- stale/expired promotion CTA cannot be re-published;
- competition CTA is not exposed before the competition phase;
- optional image URL accepts HTTPS only.

## 4.7 In-app booking notifications

1. Player confirms an online booking.
2. Open Notifications.

Expected:
- one Booking Confirmed notification exists;
- retrying the same booking request does not duplicate the notification;
- opening the notification marks it read and navigates to My Bookings.

3. Cancel the booking or have the owner cancel it.

Expected:
- one Booking Cancelled notification is created for the Player.

## 4.8 Follower marketing notifications

1. Player follows a venue.
2. Owner publishes a promotion with follower notification enabled.
3. Owner publishes a venue post with follower notification enabled.
4. Open Player Notifications.

Expected:
- relevant promotion/post alerts appear;
- disabling Promotions or Venue Posts in notification preferences suppresses future alerts of that type;
- retry/fan-out replay does not duplicate the same event.

## 4.9 Marketing frequency limit

Automated coverage verifies the server policy.

Expected:
- no more than 3 marketing notifications per user in a rolling 24-hour window;
- booking lifecycle notifications are not counted against this marketing cap.

## 4.10 Push foundation

Phase 4 stores:
- Expo push token + platform,
- push-enabled preference,
- deduped notification record,
- PENDING push delivery/outbox row.

Expected:
- registering the same Expo token is idempotent/updatable;
- disabling push prevents new PUSH delivery rows;
- in-app notification history remains server-backed.

External push-provider dispatch is intentionally not enabled in this phase.

## 4.11 Entitlement and suspension

Expected:
- Trial/Active venue can create promotions/posts;
- Expired/Cancelled venue cannot create new promotions/posts;
- suspended venue cannot publish new marketing content;
- existing owner history remains readable for continuity;
- public feed excludes suspended venue posts and invalid promotions.

## 4.12 Localization and RTL

Repeat Feed, venue follow, Notifications, Promotions and Posts in:
- Dari,
- Pashto,
- English.

Expected:
- Dari/Pashto remain RTL;
- English remains LTR;
- AFN prices, ISO timestamps and URLs remain readable;
- no raw translation keys appear.

## 4.13 Final automated verification

Run:

```powershell
pnpm verify
```

Expected:
- Phase 4 marketing verifier passes;
- Phase 3 resilience verifier still passes;
- all TypeScript checks pass;
- all tests pass;
- API build passes;
- Android Expo export passes.

Phase 4 is **Complete and verified** only after migration, automated verification and the critical live paths above pass.
