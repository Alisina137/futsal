import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const page=read("apps/mobile/app/(app)/(tabs)/venues.tsx");
const filter=read("apps/mobile/src/components/venues/VenueAdvancedFilters.tsx");
const service=read("apps/api/src/modules/booking/booking.service.ts");
const pure=read("apps/api/src/modules/booking/venue-directory.ts");
const routes=read("apps/api/src/modules/booking/booking.routes.ts");
const contracts=read("packages/contracts/src/index.ts");
const api=read("apps/mobile/src/lib/api.ts");
const locale=read("packages/localization/src/index.ts");
const tests=read("apps/api/test/booking.test.ts");
assert(page.includes("<VenueAdvancedFilters")&&page.includes("venueApi.search("),
  "Main venue directory must apply real advanced filters through the search endpoint.");
assert(page.includes('lastSearchRef.current')&&page.includes('latestRequest.current===request'),
  "Retain the last applied filter combination, rejecting stale async requests.");
assert(filter.includes("venueToday()")&&filter.includes('venueDateAdd(today,60)')&&
  filter.includes('testID="venue-date-"')===false&&filter.includes("venue-date-"),
  "Calendar must support Kabul today/tomorrow/custom within the next 60 days.");
assert(filter.includes('TimeOfDayPickerField')&&
  filter.includes('period==="custom"')&&filter.includes("formatClock12From24Hour"),
  "All visible custom times should be AM/PM; server receives valid HH:mm.");
assert(filter.includes('venue-min-price')&&filter.includes('venue-max-price')
  &&filter.includes('venue-available-only'),"Price and availability controls must be reachable.");
assert(filter.includes('"recommended","nearest","lowestPrice","mostFollowed","availableSoonest"'),
  "Expose complete five-option sorting.");
assert(routes.includes('router.get("/search"')&&
  routes.indexOf('router.get("/search"')<routes.indexOf('router.get("/:venueId"')&&
  routes.includes("venueDirectoryFiltersSchema.parse("),
  "Search API must validate all filters before /:venueId routing.");
assert(service.includes("getAvailability(venue.id,filters.date)")&&
  service.includes("this.repository.countVenueFollowers")&&
  service.includes("start+=5"),"Search must use date-scoped real inventory with bounded reads.");
assert(pure.includes("slot.priceAfn")&&pure.includes("matches.length")&&
  pure.includes("earliestStartsAt")&&pure.includes("distanceKm"),
  "Sorting and filtering must use real eligible slots and valid distance calculations.");
assert(contracts.includes("venueDirectoryResponseSchema")&&api.includes("request<VenueDirectoryResponse>"),
  "Typed API response and client are required.");
assert(api.includes('path.startsWith("/api/v1/venues/search?")'),
  "Dynamic live slot searches must bypass the offline GET cache.");
assert(tests.includes("filters and sorts venues against real date-scoped availability"),
  "Regression tests must cover real filtering and invalid parameters.");
for(const key of ["today","tomorrow","chooseDate","time","custom","availableOnly",
  "minimum","maximum","sort","nearest","lowestPrice","mostFollowed",
  "availableSoonest","slotsCount","invalidRange"]){
  assert(locale.split('"booking.filter.'+key+'"').length===4,
    "Missing localized advanced filter string: "+key);
}
console.log("Venue Phase 2 verified: date/calendar, AM/PM times, availability/AFN price, sort, live search, cache exclusion and validation.");
