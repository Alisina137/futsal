import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const schema=read("packages/database/src/schema.ts");
const sql=read("packages/database/drizzle/0039_venue_reviews_times_alerts.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const contracts=read("packages/contracts/src/index.ts");
const routes=read("apps/api/src/modules/booking/booking.routes.ts");
const service=read("apps/api/src/modules/booking/booking.service.ts");
const repo=read("apps/api/src/modules/booking/booking.repository.ts");
const notification=read("apps/api/src/modules/notifications/notification.service.ts");
const notificationUi=read("apps/mobile/app/(app)/notifications.tsx");
const detail=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const sections=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const timetable=read("apps/mobile/src/components/venues/VenueSlotTimetable.tsx");
const community=read("apps/mobile/src/components/venues/VenueCommunityPanels.tsx");
const reservations=read("apps/mobile/src/components/bookings/ReservationsPanel.tsx");
const localize=read("packages/localization/src/index.ts");
const tests=read("apps/api/test/booking.test.ts");
check(schema.includes('export const venueReviews=pgTable("venue_reviews"')&&
  schema.includes('export const venueSavedTimes=pgTable("venue_saved_times"')&&
  schema.includes('export const venueSlotWatches=pgTable("venue_slot_watches"'),
  "Three persistent venue engagement tables required.");
check(sql.includes('"venue_reviews"')&&sql.includes('"venue_saved_times"')&&
  sql.includes('"venue_slot_watches"')&&
  journal.includes("0039_venue_reviews_times_alerts"),
  "Migration and journal must register the same new entities.");
check(sql.includes('UNIQUE ("booking_id")')&&sql.includes('UNIQUE ("user_id", "area_id", "starts_at")'),
  "Review and slot watch one-shot uniqueness must be enforced at database level.");
check(contracts.includes("venueReviewCreateSchema")&&contracts.includes("venueSlotWatchCreateSchema"),
  "Typed API validation is required.");
check(service.includes('booking.playerUserId!==userId')&&
  service.includes('booking.status!=="CONFIRMED"')&&
  service.includes('Date.parse(booking.endsAt)>this.now().getTime()')&&
  service.includes('booking.source!=="ONLINE"'),
  "Only confirmed completed own online bookings may be reviewed.");
check(routes.includes('router.get("/:venueId/reviews"')&&
  routes.includes('router.post("/reviews"')&&
  routes.includes('router.put("/venue-preferences/:venueId"')&&
  routes.includes('router.post("/slot-watches"'),
  "Phase 5 APIs must be available publicly for reads and authenticated for writes.");
check(service.includes('x.status==="UNAVAILABLE"')&&
  service.includes('this.repository.listPlayerBookings(userId)')&&
  service.includes('current.slots.some')&&
  service.includes("await this.notifications.slotAvailable"),
  "Watch requests must require occupied real slots and cancellation notification must recheck actual availability.");
check((service.match(/await this.announceReopenedSlot\(cancelled\)/g)??[]).length===2,
  "Both owner and player cancellation flows must trigger one-shot reopen alerts.");
check(repo.includes('onConflictDoNothing({target:venueReviews.bookingId})')&&
  repo.includes('onConflictDoUpdate({target:[venueSavedTimes.userId,venueSavedTimes.venueId]'),
  "Review submissions must be one per booking and saved times scoped per user.");
check(notification.includes('type:"SLOT_AVAILABLE"')&&
  notification.includes('marketing:false')&&
  notificationUi.includes('case "SLOT_AVAILABLE"'),
  "Slot reopened notifications must be transactional, user-requested and actionable.");
check(sections.includes('about:["overview","facilities","hours","location","reviews","policies","preferences"]')&&
  detail.includes("reviewBookingId")&&
  community.includes("<TimeOfDayPickerField")&&
  community.includes("bookingApi.review")&&
  reservations.includes("booking-rate-venue-"),
  "Reviews, favorite times and completed-booking rate CTA must be accessible from existing UI.");
check(timetable.includes("bookingApi.watchSlot")&&
  timetable.includes("bookingApi.unwatchSlot")&&
  timetable.includes("bookingApi.saveVenueTime"),
  "Timetable must make alerts reversible and allow saving a favorite local start time.");
check(tests.includes("accepts one verified review")&&
  tests.includes("persists per-user favorite times"),
  "Backend integration tests must enforce ownership, uniqueness and canceled-slot alerts.");
for(const k of ["reviews","preferences","reviewEligibility","writeReview","rateVenue",
  "savedTime","watchSlot","stopWatch","watchExplanation","saveFavorite"]){
  check(localize.split('"booking.community.'+k+'"').length===4,
    "Phase 5 community locale missing in en/Dari/Pashto: "+k);
}
console.log("Venues Phase 5 checks: verified reviews, saved time, protected single-use watched slots, multilingual UI and booking history.");
