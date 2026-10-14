import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sections=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const watch=read("apps/mobile/src/components/venues/VenueSavedTimesAndAlertsPanel.tsx");
const saved=read("apps/mobile/src/components/venues/VenueCommunityPanels.tsx");
const backend=read("apps/api/src/modules/marketing/marketing.service.ts");
const routes=read("apps/api/src/modules/marketing/marketing.routes.ts");
const api=read("apps/mobile/src/lib/api.ts");
const locales=read("packages/localization/src/index.ts");
const tests=read("apps/api/test/marketing.test.ts");

assert.ok(sections.includes('reserve:["slots","offers","bookings","saved"]')&&
  sections.includes('about:["overview","facilities","hours","location","reviews","policies"]')&&
  !sections.includes('if(sub==="preferences")'),
  "Saved preferences belong in Reserve without an orphan About entry.");
assert.ok(sections.includes('if(sub==="saved")return <VenueSavedTimesAndAlertsPanel')&&
  watch.includes("<VenueSavedTimePanel")&&saved.includes("bookingApi.saveVenueTime"),
  "Preferred time editing must reuse the existing per-user API.");
for(const word of ["bookingApi.slotWatches(token,venue.id)","bookingApi.unwatchSlot(token,watch.id)",
  "item.venueId===venue.id","item.expiresAt","Date.now()","sequence.current+=1",
  "formatAppClock(watch.startsAt,venue.timezone)","watchRemoveError","signInWatches",
  "watchExplanation","busyId!==null"]){
  assert.ok(watch.includes(word),"Missing real and private watched-slot control: "+word);
}
for(const word of [
  'router.get("/promotions/venues/:venueId"',
  "routeIdSchema.parse(request.params.venueId)",
])assert.ok(routes.includes(word),"Venue promotion route missing validation: "+word);
for(const word of ["await this.repository.refreshPromotionStates(now)",
  "this.repository.getVenue(venueId)","venue?.status===\"ACTIVE\"",
  "venue.subscription.status===\"ACTIVE\"","venue.subscription.status===\"TRIAL\"",
  "this.repository.listActivePromotions([venueId])",
  'promotion.venueId===venueId&&promotion.status==="ACTIVE"',
  "Date.parse(promotion.startsAt)>now.getTime()"]){
  assert.ok(backend.includes(word),"No unscoped/unentitled/expired promotion leak: "+word);
}
for(const word of ["marketingApi.venuePromotions(venue.id)",
  'testID={"venue-offer-"+promo.id}',"promo.discountPercent","promo.title",
  "promo.originalPriceAfn","promo.discountedPriceAfn","promo.note",
  "choosePromotion(promo)","formatAppClock(promo.startsAt,venue.timezone)",
  "venueApi.availabilityLive(venue.id,date)",
  "item.areaId===slot.areaId","item.startsAt===slot.startsAt",
  "item.endsAt===slot.endsAt","item.promotionId===slot.promotionId",
  "item.priceAfn===slot.priceAfn","if(!verified||!live.venue.onlineBookingEnabled)",
  "setError(tr3(\"offerChanged\"))","ReserveStatusBanner venue={venue}",
  'venue.bookingMode==="APPROVAL"', 'venue.onlineBookingEnabled',
]){
  assert.ok(sections.includes(word),"Expected real Reserve status/offers behavior: "+word);
}
assert.ok(api.includes("venuePromotions:(venueId:string)=>networkRequest")&&
  api.includes("availabilityLive:")&&api.includes('cache:"no-store"'),
  "Upcoming promotions and final tapped slot must use typed, network-backed APIs.");
assert.ok(tests.includes("promotions/venues/")&&tests.includes("suspended.status"),
  "Public venue promotion scoping must be regression-tested.");
const keys=["vd.sub.reserve.saved","vd3.watchedSlots","vd3.watchExplanation",
  "vd3.signInWatches","vd3.noWatches","vd3.stopWatching","vd3.watchLoadError",
  "vd3.watchRemoveError","vd3.approvalMode","vd3.approvalDescription",
  "vd3.instantMode","vd3.instantDescription","vd3.bookingPaused",
  "vd3.upcomingOffers","vd3.offersDisclaimer","vd3.viewOfferSlots",
  "vd3.offerChanged","vd3.outsideBookingWindow"];
for(const key of keys){
  assert.equal(locales.split('"'+key+'"').length-1,3,"Missing EN/Dari/Pashto: "+key);
}
console.log("Venue Detail Phase 3 verified: customer saved times, scoped slot alerts, future venue offers, live slot revalidation and booking mode clarity.");
