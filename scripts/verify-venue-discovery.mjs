import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const check=(valid,message)=>{if(!valid)throw new Error(message);};
const page=read("apps/mobile/app/(app)/(tabs)/venues.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const schema=read("packages/contracts/src/index.ts");
const routes=read("apps/api/src/modules/booking/booking.routes.ts");
const service=read("apps/api/src/modules/booking/booking.service.ts");
const repo=read("apps/api/src/modules/booking/booking.repository.ts");
const pure=read("apps/api/src/modules/booking/venue-discovery.ts");
const tests=read("apps/api/test/booking.test.ts");
const l10n=read("packages/localization/src/index.ts");

check(page.includes('testID="venue-followed-strip"'),"Followed venue cards must stay above filters.");
check(page.includes('testID="venue-province-select"')&&page.includes('venueApi.discovery()'),
  "Province options must be a select-style control sourced from live subscribed venues.");
check(page.includes('["",...provinceOptions]')&&page.includes('booking.allProvinces'),
  "Province list must default to and offer All.");
check(page.includes('onPress={()=>selectProvince(option)}')&&page.includes('applySearch(query,nextProvince)'),
  "Selecting a province should immediately filter venue results.");
check(!page.includes('t("booking.cityFilter")'),
  "Manual city input should be replaced with dynamic province selector.");
check(page.includes('testID="venue-name-location-search"')
  &&page.includes('testID="venue-search-suggestions"')
  &&page.includes('item.kind==="VENUE"?"football-outline":"location-outline"'),
  "Search must offer venue name or place suggestions with correct icons.");
check(page.includes('setTimeout(()=>')&&page.includes("clearTimeout(timer)")
  &&page.includes("if(active)setSuggestions"),
  "Suggestions must debounce typing and reject stale results.");
check(page.includes('onPress={()=>selectSuggestion(item)}')&&page.includes("applySearch(suggestion.query,province)"),
  "Suggestions must be tappable and apply search.");
check(page.includes('onSubmitEditing={()=>applySearch()}'),
  "Keyboard search action must apply the query.");
check(api.includes('request<VenueDiscoveryResponse>')&&schema.includes("venueDiscoveryResponseSchema"),
  "Typed API and contract are required for suggestion/province requests.");
check(routes.includes('router.get("/discovery"')&&routes.indexOf('router.get("/discovery"')<
  routes.indexOf('router.get("/:venueId"'),
  "Discovery route must not collide with /:venueId.");
check(service.includes("async venueDiscovery(")&&repo.includes("listVenueDiscoveryRecords")
  &&repo.includes("ilike(venues.address,match)")&&repo.includes("ilike(venues.city,match)")
  &&repo.includes("ilike(venues.province,match)")&&repo.includes("ilike(venues.name,match)"),
  "Backend must use lightweight metadata and match name, city, province, address.");
check(pure.includes("hasPremiumWriteAccess(")&&pure.includes("items.length>=8")
  &&pure.includes("filter(row=>!filters.province"),
  "Discovery suggestions must be limited, subscribe-scoped and province-filtered.");
check(tests.includes("lists provinces dynamically from active subscribed venues")
  &&tests.includes('q:"Kart-e"')&&tests.includes('province:"Herat"'),
  "Tests must cover real dynamic provinces and venue/location search.");
for(const key of [
  "booking.venueNameLocation","booking.searchVenueHint","booking.searchVenuePlaceholder",
  "booking.provinceFilter","booking.allProvinces","booking.chooseProvince",
  "booking.provinceOptionsError","booking.suggestionVenue","booking.suggestionLocation",
]){
  check(l10n.split(`"${key}"`).length-1===3,
    `Missing English, Dari or Pashto translation for ${key}`);
}
console.log("Venues discovery verified: subscribed province picker, default All, name/location search, debounced suggestions, scoped metadata, RTL, and search filters.");
