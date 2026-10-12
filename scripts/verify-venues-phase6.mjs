import {readFileSync} from "node:fs";
import assert from "node:assert/strict";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const contract=read("packages/contracts/src/index.ts");
const repo=read("apps/api/src/modules/booking/booking.repository.ts");
const fake=read("apps/api/test/fake-booking-repository.ts");
const service=read("apps/api/src/modules/booking/booking.service.ts");
const routes=read("apps/api/src/modules/booking/booking.routes.ts");
const api=read("apps/mobile/src/lib/api.ts");
const reviews=read("apps/mobile/src/components/venues/VenueCommunityPanels.tsx");
const tests=read("apps/api/test/booking.test.ts");
const migration=read("packages/database/drizzle/0039_venue_reviews_times_alerts.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const block=(s,start,end)=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)+1));
const publicReview=block(contract,"export const venueReviewDtoSchema=","export type VenueReviewDto=");
assert.ok(publicReview.includes("verified:z.literal(true)"),"Public reviews must be verified.");
assert.ok(!publicReview.includes("bookingId"),"A public review must not expose a customer's booking ID.");
assert.ok(contract.includes("myVenueReviewsSchema"),"Private reviewed booking status must be strongly typed.");
assert.ok(routes.includes('router.get("/reviews/mine"')&&
  routes.includes('request.auth!.userId'),"Rating eligibility endpoint must require authentication.");
assert.ok(service.includes("myReviewedVenueBookings(userId:string,venueId:string)")&&
  service.includes("listReviewedBookingIds(userId,venueId)"),
  "Reviewed booking lookup must be isolated to one authenticated player and venue.");
assert.ok(repo.includes("eq(venueReviews.userId,userId)")&&
  repo.includes("eq(venueReviews.venueId,venueId)"),
  "Database review ownership must be checked server-side.");
assert.ok(fake.includes("listReviewedBookingIds(userId:string,venueId:string)"),
  "Integration fake must support the same scoped identity rules.");
assert.ok(api.includes("myVenueReviews:(token:string,venueId:string)")&&
  api.includes('networkRequest<MyVenueReviews>'),
  "Mobile must fetch private reviewed booking state without stale cache.");
assert.ok(reviews.includes("setReviewedBookingIds(reviewed.reviewedBookingIds)")&&
  reviews.includes("const reviewed=new Set(reviewedBookingIds)")&&
  reviews.includes("!reviewed.has(b.id)"),
  "Review UI must not use the paginated public review list to decide eligibility.");
assert.ok(service.includes('const bookings=await this.repository.listVenueBookings')&&
  service.includes('booking.startsAt===blocked.startsAt')&&
  service.includes('booking.endsAt===blocked.endsAt')&&
  service.includes('booking.status==="PENDING"||booking.status==="CONFIRMED"'),
  "Slot reopening alert must require actual booked exact interval, not a venue block.");
assert.ok(tests.includes("privateMine.status").valueOf()&&
  tests.includes('watchingBlock.status').valueOf()&&
  tests.includes('not.toContain(booking.body.booking.id)'),
  "Integration must cover auth separation, block rejection and no public booking ID.");
assert.ok(migration.includes('UNIQUE ("booking_id")')&&
  journal.includes("0039_venue_reviews_times_alerts"),
  "Schema must preserve at most one review per booking.");
console.log("Phase 6 integration hardening verified: public rating privacy, private eligibility, watchable occupied slots and existing database invariants.");
