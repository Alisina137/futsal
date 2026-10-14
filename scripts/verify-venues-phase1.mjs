import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const assert=(truth,message)=>{if(!truth)throw new Error(message);};
const screen=read("apps/mobile/app/(app)/(tabs)/venues.tsx");
const card=read("apps/mobile/src/components/venues/VenueResultCard.tsx");
const detail=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const locale=read("packages/localization/src/index.ts");

for(const marker of ["venue-followed-strip","venue-search-panel","venue-results-section","venue-results-grid"]){
  assert(screen.includes('testID="'+marker+'"'),"Missing directory section: "+marker);
}
assert(screen.indexOf('testID="venue-followed-strip"')<
  screen.indexOf('testID="venue-search-panel"')&&
  screen.indexOf('testID="venue-search-panel"')<
  screen.indexOf('testID="venue-results-section"'),
  "Followed rail, province/search controls and results must appear in order.");
assert(screen.includes("const MAX_VISIBLE_FOLLOWS=10")&&
  screen.includes('router.push("/venues/following")'),
  "Preserve ten followed venues and dedicated Show More destination.");
assert(screen.includes('testID="venue-most-followed-button"')&&
  screen.includes('testID="venue-nearby-button"'),
  "Existing popular and nearby routes must remain discoverable during phase one.");
assert(screen.includes('venues.map(venue=><VenueResultCard')&&
  screen.includes('twoColumn={twoColumns}')&&
  screen.includes('flexWrap:"wrap"'),
  "Use one responsive directory with shared venue cards, not repeated lists.");
assert(screen.includes("latestRequest.current===request")&&
  screen.includes("lastSearchRef.current")&&
  screen.includes("useFocusEffect("),
  "Stale network searches must not override filters and returning must refresh safely.");
assert(screen.includes('testID="venue-refresh-results"')&&
  screen.includes('t("booking.resetSearch")')&&
  screen.includes('t("common.retry")'),
  "Results need recovery, refresh, and clear-empty-state actions.");
assert(!screen.includes('t("booking.venuesTitle")')&&
  !screen.includes('t("booking.venuesSubtitle")'),
  "Do not reintroduce the removed redundant page title.");
assert(card.includes('width:"25%"')&&card.includes('width:"75%"')&&
  card.includes('gridCard:{width:"48%"}')&&
  card.includes('aspectRatio:1'),
  "Venue cards must preserve the 25/75 hierarchy and square images in two-column layout.");
assert(card.includes('focusAvailability:"1"')&&
  detail.includes('switchVenueMain(current,"reserve","slots")'),
  "Reserve buttons must enter the existing real availability tab without auto-booking.");
for(const key of ["booking.resultsHeading","booking.resultsCount","booking.resetSearch"]){
  assert(locale.split('"'+key+'"').length===4,"Missing English/Dari/Pashto translation: "+key);
}
console.log("Venues phase one verified: followed rail, accessible filters, compact responsive results, safe search refresh, empty states, and booking navigation.");
