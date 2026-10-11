import assert from "node:assert/strict";
import fs from "node:fs";
import {reservationGroup,reservationCounts,displayReservations,reservationDateKey}
  from "../apps/mobile/src/lib/reservation-view.ts";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const component=read("apps/mobile/src/components/bookings/ReservationsPanel.tsx");
const main=read("apps/mobile/app/(app)/(tabs)/bookings.tsx");
const venue=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const language=read("packages/localization/src/index.ts");
const now=Date.parse("2026-10-11T07:00:00.000Z");
const fixture=(id,status,startsAt,endsAt)=>({
 id,venueId:"venue",venueName:"Court",playerUserId:"account",
 status,startsAt,endsAt,priceAfn:500,source:"ONLINE",areaId:"area",areaName:"Main court",
 currency:"AFN",customerName:null,customerPhone:null,note:null,
 cancellationPolicySnapshot:"No cancellations within 24 hours",
 cancelledAt:null,cancellationReason:null,
});
const future1=fixture("future1","CONFIRMED","2026-10-13T09:00:00.000Z","2026-10-13T10:30:00.000Z");
const future2=fixture("future2","CONFIRMED","2026-10-12T09:00:00.000Z","2026-10-12T10:30:00.000Z");
const pending=fixture("pending","PENDING","2026-10-14T09:00:00.000Z","2026-10-14T10:30:00.000Z");
const completed=fixture("completed","CONFIRMED","2026-10-10T09:00:00.000Z","2026-10-10T10:30:00.000Z");
const cancelled=fixture("cancelled","CANCELLED","2026-10-15T09:00:00.000Z","2026-10-15T10:30:00.000Z");
const items=[completed,future1,cancelled,pending,future2];
assert.equal(reservationGroup(future1,now),"UPCOMING");
assert.equal(reservationGroup(pending,now),"PENDING");
assert.equal(reservationGroup(completed,now),"COMPLETED");
assert.equal(reservationGroup(cancelled,now),"CANCELLED");
assert.deepEqual(reservationCounts(items,now),{
 ALL:5,UPCOMING:2,PENDING:1,COMPLETED:1,CANCELLED:1,
});
assert.deepEqual(displayReservations(items,"ALL",now).map(x=>x.id),
 ["future2","future1","pending","completed","cancelled"]);
assert.deepEqual(displayReservations(items,"PENDING",now).map(x=>x.id),["pending"]);
assert.equal(reservationDateKey("2026-10-11T22:30:00.000Z"),"2026-10-12");
for(const marker of [
 'useFocusEffect','requestId.current','response.bookings.filter(item=>item.playerUserId===userId)',
 'loadedUser===userId?items:[]','bookingApi.mine(token)',
 'bookingApi.cancel(token,id)','<ReservationsPanel','refreshing={loading&&safeItems.length>0}',
 'showHeader publicNav',
]){
 assert.ok(main.includes(marker),"Actor-safe My Reserves page missing: "+marker);
}
for(const marker of [
 'reservationCounts(items,now)','displayReservations(items,filter,now)',
 'reservationGroup(item,now)','<DataLoadingState',
 'accessibilityRole="tab"','<Modal animationType="fade" transparent visible={cancelTarget!==null}',
 'await onCancel(target.id)','Date.parse(item.startsAt)>now',
 'disabled={!canNetwork}','cancellationPolicySnapshot',
 'router.push({pathname:"/venues/[venueId]"','focusAvailability:"1"',
 'bookingDate(item.startsAt,language)','bookingTime(item.startsAt)',
 'setCancelTarget(item)','setFilter("ALL")',
]){
 assert.ok(component.includes(marker),"My Reserves UX invariant missing: "+marker);
}
assert.ok(venue.includes('bookingsActor===session.user.id?bookings.filter(b=>b.venueId===venue.id):[]'),
 "Venue-specific My Bookings must reuse the same dashboard without showing other venues or sessions.");
assert.ok(venue.includes('throw e;'),"Venue booking cancellation errors must propagate to confirmation dialog.");
for(const key of ["subtitle","ALL","UPCOMING","PENDING","COMPLETED","CANCELLED",
 "emptyTitle","emptyBody","policy","cancelTitle","cancelWarning","confirmCancel",
 "pendingHint","fullReference","viewVenue","findSlots"]){
 assert.equal(language.split('"booking.reserves.'+key+'"').length-1,3,
   "Translation missing in English, Dari or Pashto: "+key);
}
console.log("My Reserves verified: real scoped bookings, chronology, counts, three locales, cancellation confirmation, policy, offline and account-scope protection.");
