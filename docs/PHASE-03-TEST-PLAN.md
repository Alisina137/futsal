# Phase 3 Test Plan — Availability, Schedule and Booking

Use this checklist after `pnpm verify` and the Phase 3 database migration both succeed.

## Preconditions

- API is running on port 4000.
- Mobile app is connected to the API from the Android device.
- A Venue Owner account has completed onboarding.
- The venue has at least one active playing area.
- The venue has opening hours and a base price.
- The venue has an active Trial or Active subscription state.
- At least two Player accounts are available for conflict testing.

## 3.1 Public venue discovery

1. Sign in as a Player.
2. Open **Venues**.
3. Confirm the active venue appears.
4. Filter by the venue city and confirm the result remains.
5. Open the venue.
6. Confirm venue name, city/province, address and public phone are visible.

Expected:
- only ACTIVE venues with current Trial/Active entitlement are discoverable;
- suspended/expired venues do not expose new bookable inventory.

## 3.2 Live availability

1. Choose a future date when the venue is open.
2. Confirm available slots are shown per playing area.
3. Confirm each slot shows:
   - area name,
   - start/end time,
   - AFN price.
4. Compare the first slot with the venue opening time and configured session duration.

Expected:
- slots are derived from opening hours;
- slot duration matches the area's configured default duration;
- price matches the area's current base price;
- past slots are not shown.

## 3.3 Online booking

1. Select one live slot.
2. Open the confirmation screen.
3. Add an optional note.
4. Confirm the booking.

Expected:
- booking succeeds only while online;
- the server revalidates availability;
- booking appears in **My Bookings**;
- the owner schedule shows the same booking;
- price and cancellation policy are persisted on the booking.

## 3.4 Concurrent booking conflict

Automated coverage exists in `apps/api/test/booking.test.ts`, but also perform a manual sanity check if practical:

1. Open the same available slot with Player A and Player B.
2. Confirm it first with Player A.
3. Immediately confirm it with Player B.

Expected:
- Player A succeeds;
- Player B receives the friendly slot-unavailable state;
- only one active booking exists.

## 3.5 Owner manual booking

1. Sign in as the Venue Owner.
2. Open **Schedule**.
3. Choose a future date.
4. Tap **Add manual booking**.
5. Select the playing area.
6. Enter start/end time and customer name.
7. Optionally enter phone, price and note.
8. Create the booking.

Expected:
- manual booking appears on the same owner schedule;
- the corresponding player-facing availability disappears;
- manual and online bookings cannot overlap.

## 3.6 Block and unblock time

1. On the owner schedule, choose a future free interval.
2. Create a block with a reason.
3. Refresh player availability for that date.
4. Confirm the blocked interval is absent.
5. Return to owner Schedule and remove the block.
6. Refresh player availability.

Expected:
- block consumes the same playing-area capacity as a booking;
- unblock restores availability if no booking occupies that interval.

## 3.7 Player cancellation

1. As a Player, open an upcoming active booking.
2. Cancel it.
3. Refresh My Bookings.
4. Refresh owner Schedule.
5. Refresh venue availability.

Expected:
- booking status becomes CANCELLED;
- it remains in booking history;
- cancelled booking no longer consumes capacity;
- the slot becomes available again if nothing else occupies it.

## 3.8 Owner cancellation

1. Create or locate an upcoming booking.
2. Sign in as its venue owner.
3. Cancel the booking from Schedule.

Expected:
- owner can cancel only bookings belonging to their own venue;
- another venue owner cannot cancel it;
- the released interval becomes available again.

## 3.9 Offline cached availability

1. While online, open a venue/date with available slots.
2. Confirm the live availability loads.
3. Disable network connectivity.
4. Reopen the same venue/date.

Expected:
- cached availability may still display;
- a stale/cached warning is visible;
- booking buttons are disabled;
- no offline confirmation is possible.

5. Re-enable connectivity.

Expected:
- reconnect triggers a fresh server request;
- live booking actions become available only after successful live refresh.

## 3.10 Expired entitlement

Use a test venue/trial or controlled database/test clock.

Expected:
- expired/cancelled/suspended venue does not expose new public availability;
- new online bookings are rejected;
- new owner manual bookings/blocks are rejected;
- owner can still read the existing schedule for service continuity.

## 3.11 RTL and localization

Repeat player discovery/booking and owner schedule flows in:
- Dari,
- Pashto,
- English.

Expected:
- Dari/Pashto layouts remain RTL;
- English remains LTR;
- phone numbers, ISO/debug timestamps and AFN values remain readable;
- no raw translation keys appear.

## 3.12 Final Phase 3 verification

Run:

```powershell
pnpm verify
```

Expected:
- Phase 3 resilience verifier passes;
- all workspace typechecks pass;
- all automated tests pass;
- API build passes;
- Android Expo export passes.

Phase 3 can be marked **Complete and verified** only after the migration, automated verification and the critical live smoke paths above succeed.
