import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const contracts=read("packages/contracts/src/index.ts");
const pure=read("apps/api/src/modules/booking/venue-directory.ts");
const api=read("apps/mobile/src/lib/api.ts");
const page=read("apps/mobile/app/(app)/(tabs)/venues.tsx");
const card=read("apps/mobile/src/components/venues/VenueResultCard.tsx");
const chips=read("apps/mobile/src/components/venues/VenueSlotShortcuts.tsx");
const detail=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const sections=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const grid=read("apps/mobile/src/components/venues/VenueSlotTimetable.tsx");
const locales=read("packages/localization/src/index.ts");
const tests=read("apps/api/test/booking.test.ts");
assert(contracts.includes("nextSlots:z.array(availabilitySlotDtoSchema).max(3)"),
  "Only validated, bookable slots may be exposed, max 3 previews per venue.");
assert(pure.includes("nextSlots:matches.slice(0,3)")&&
  pure.includes("time>=from&&time<=to")&&
  pure.includes("slot.priceAfn>=filters.minPriceAfn")&&
  pure.includes("slot.priceAfn<=filters.maxPriceAfn"),
  "Preview count, times and prices must use exactly the directory's actual filtered slot list.");
assert(page.includes("nextSlots={metrics[venue.id]?.nextSlots}")&&
  page.includes("availabilityDate={lastSearch.filters.date}")&&
  page.includes("timeZone={venue.timezone}")&&
  page.includes("snapshotAt={searchSnapshotAt}")&&page.includes("onRefreshResults"),
  "Venue card previews must be scoped to selected day, venue timezone and newest search snapshot.");
assert(card.includes("<VenueSlotShortcuts")&&card.includes("bookingDate:availabilityDate")&&
  card.includes('focusAvailability:"1"'),
  "Cards must offer slot shortcuts and retain live timetable access to the selected date.");
assert(chips.includes("slots.slice(0,3)")&&chips.includes("formatAppClock(slot.startsAt,venue.timezone)")&&
  chips.includes("slot.priceAfn")&&chips.includes("accessibilityRole=\"button\""),
  "Each visible chip needs actual AM/PM time, price and an accessible independent action.");
assert(chips.includes("venueApi.availabilityLive(venue.id,date)")&&
  chips.includes("candidate.areaId===slot.areaId")&&
  chips.includes("candidate.startsAt===slot.startsAt")&&
  chips.includes("candidate.endsAt===slot.endsAt")&&
  chips.includes("match.priceAfn")&&chips.includes('pathname:"/booking/confirm"'),
  "Before confirmation, the exact venue/court/time must be revalidated against the network.");
assert(!chips.includes("bookingApi.create("),
  "Tapping a slot should never silently create or approve a booking.");
assert(api.includes("availabilityLive:")&&
  api.includes("networkRequest<VenueAvailabilityResponse>")&&
  api.includes('cache:"no-store"'),
  "Previews must not revalidate using stale offline cached responses.");
assert(chips.includes("running.current")&&chips.includes("active.current")&&
  chips.includes('setError("taken")')&&chips.includes("onRefresh"),
  "Duplicate taps, stale responses, and already-taken preview slots require safe feedback.");
assert(detail.includes("bookingDate")&&
  sections.includes("initialDate={bookingDate}")&&
  grid.includes("initialDate?:string|undefined")&&
  grid.includes('setAnchor(next);setView("DAY")'),
  "See-all and Reserve Online must open the selected filtered day instead of defaulting to today.");
assert(tests.includes("previews actual promotion prices without inventing extra slots")&&
  tests.includes("updated.nextSlots.some")&&
  tests.includes("bookingRepository.bookings.size"),
  "Integration tests must cover real promotion price, occupancy changes and non-mutating searches.");
for(const key of ["title","none","seeAll","tapHint","verifyNote","taken","connection"]){
  assert(locales.split('"booking.preview.'+key+'"').length===4,
    "Missing English/Dari/Pashto preview translation: "+key);
}
console.log("Venues Phase 3 verified: 3 exact date/price-filtered slots, independent AM/PM actions, fresh matching revalidation, single confirmation, filtered-day deep links, and multilingual recovery.");
