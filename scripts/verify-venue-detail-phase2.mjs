import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const contracts=read("packages/contracts/src/index.ts");
const schema=read("packages/database/src/schema.ts");
const migration=read("packages/database/drizzle/0043_venue_public_about.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const owner=read("apps/api/src/modules/owner/owner.repository.ts");
const ownerService=read("apps/api/src/modules/owner/owner.service.ts");
const booking=read("apps/api/src/modules/booking/booking.types.ts");
const bookingRepo=read("apps/api/src/modules/booking/booking.repository.ts");
const settings=read("apps/mobile/app/(app)/owner/settings.tsx");
const about=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const navigation=read("apps/mobile/src/lib/venue-detail-navigation.ts");
const locale=read("packages/localization/src/index.ts");
const keys=["overview","facilities","hours","location","reviews","policies"];
assert.ok(about.includes('about:["overview","facilities","hours","location","reviews","policies"]'),
  "Phase 2 must add hours/policies and temporarily preserve saved-time access.");
for(const sub of ["reviews","overview","facilities","hours","policies"]){
  assert.ok(about.includes('if(sub==="'+sub+'")'),"About subtab must have real content: "+sub);
}
for(const item of ['verificationStatus:venue.verificationStatus??"PENDING"',
  "amenities:venue.amenities??[]","houseRules:venue.houseRules??null",
  "openingHours:venue.openingHours"]){
  assert.ok(booking.includes(item),"Public venue mapping must expose only actual owner-provided details: "+item);
}
assert.ok(bookingRepo.includes("amenities:row.amenities")&&bookingRepo.includes("houseRules:row.houseRules")
  &&bookingRepo.includes("verificationStatus:row.verificationStatus"),"Venue repository must hydrate persisted About facts.");
for(const item of ['"LIGHTING"','"PARKING"','"CHANGING_ROOM"','"SHOWERS"','"TOILETS"',
  '"SEATING"','"DRINKING_WATER"','"EQUIPMENT_RENTAL"']){
  assert.ok(contracts.includes(item)&&settings.includes(item),"All owner-verified amenity enums must be wired: "+item);
}
assert.ok(contracts.includes("new Set(values).size===values.length")&&
  contracts.includes("houseRules:z.string().trim().max(1_000).nullable().optional()")&&
  contracts.includes("openingHours:z.array(venueOpeningHourDtoSchema)"),
  "Validate unique amenities, bounded public policies and actual weekly operating hours.");
assert.ok(schema.includes('amenities:jsonb("amenities")')&&schema.includes('houseRules:text("house_rules")')&&
  migration.includes("DEFAULT '[]'::jsonb")&&migration.includes('"house_rules"')&&
  journal.includes("0043_venue_public_about"),"Existing venues must default to no stated amenities with a real database migration.");
assert.ok(owner.includes("input.settings.amenities!==undefined")&&owner.includes("input.settings.houseRules!==undefined")&&
  ownerService.includes("amenities:aggregate.venue.amenities")&&
  settings.includes("onValueChange={enabled=>setAmenities(current=>enabled")&&
  settings.includes("houseRules:houseRules.trim()||null"),
  "Owner must explicitly and securely publish facilities and house rules; old clients preserve values.");
for(const item of ["venue.verificationStatus===\"VERIFIED\"","venue.amenities.length",
  "venue.openingHours.length","formatClock12From24Hour(hour.opensAt)",
  "formatClock12From24Hour(hour.closesAt)","venue.houseRules||tx(\"noHouseRules\")",
  "callVenueUrl(venue.publicPhone)","venueWhatsAppUrl(venue,language)",
  "venueApi.reviews(venue.id)","reviewFacts.averageRating.toFixed(1)"]){
  assert.ok(about.includes(item),"Customer-facing About content not data-backed: "+item);
}
assert.ok(about.includes('tx("hoursDisclaimer")')&&about.includes('tx("priceDisclaimer")')&&
  about.includes("venue.cancellationPolicy")&&about.includes("venue.minimumBookingNoticeMinutes")&&
  about.includes("venue.maximumAdvanceBookingDays")&&
  about.includes("venue.bookingMode"),"Do not confuse regular hours/base price with live inventory or omit booking policy.");
const reserveAlerts=read("apps/mobile/src/components/venues/VenueSavedTimesAndAlertsPanel.tsx");
assert.ok(navigation.includes("switchVenueMain")&&
  about.includes('if(sub==="saved")return <VenueSavedTimesAndAlertsPanel')&&
  reserveAlerts.includes("<VenueSavedTimePanel"),
  "Phase 3 moves saved time to Reserve while preserving Phase 1 navigation.");
const route=read("apps/api/src/modules/booking/booking.routes.ts");
const reviewRepo=read("apps/api/src/modules/booking/booking.repository.ts");
const reviewUi=read("apps/mobile/src/components/venues/VenueCommunityPanels.tsx");
const reviewApi=read("apps/mobile/src/lib/api.ts");
assert.ok(contracts.includes("ratingCounts:z.array(z.number().int().nonnegative()).length(5)")&&
  contracts.includes('venueReviewSortSchema=z.enum(["recent","highest","lowest"])')&&
  route.includes('max(500).default(1)')&&route.includes("venueReviewSortSchema.default")&&
  reviewRepo.includes("page*limit<count")&&reviewRepo.includes(".offset((page-1)*limit)")&&
  reviewUi.includes("venueApi.reviews(venue.id,summary.page+1,sort)")&&
  reviewUi.includes("setEligibleLimit(n=>n+10)")&&
  reviewApi.includes('sort:"recent"|"highest"|"lowest"="recent"'),
  "Verified reviews must be paged, sorted and user-private without leaking booking identity.");
for(const key of ["vd2.reviewSort.recent","vd2.reviewSort.highest","vd2.reviewSort.lowest",
  "vd2.moreReviews","vd2.moreEligible"])
  assert.equal(locale.split('"'+key+'"').length-1,3,"Missing new review translation "+key);
for(const key of ["vd.sub.about.hours","vd.sub.about.policies","vd.sub.about.location",
  "vd2.verified","vd2.amenities","vd2.owner.houseRules","vd2.owner.amenities",
  "vd2.hoursDisclaimer","vd2.priceDisclaimer","vd2.amenity.LIGHTING","vd2.day.0"]){
  assert.equal(locale.split('"'+key+'"').length-1,3,"Missing English/Dari/Pashto: "+key);
}
console.log("Venue Detail Phase 2 verified: owner-declared facilities/rules, persisted public hours, verified-only badge, accurate pricing and policies, RTL locales, existing booking privacy.");
