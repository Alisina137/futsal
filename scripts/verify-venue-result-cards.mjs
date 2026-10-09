import { readFileSync } from "node:fs";
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const card=read("apps/mobile/src/components/venues/VenueResultCard.tsx");
const listing=read("apps/mobile/app/(app)/(tabs)/venues.tsx");
const following=read("apps/mobile/app/(app)/venues/following.tsx");
const detail=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const screen=read("apps/mobile/src/components/ui/Screen.tsx");
const locales=read("packages/localization/src/index.ts");

assert(card.includes('width:"25%"')&&card.includes('width:"75%"')&&card.includes('aspectRatio:1'),
  "Result card must reserve 25% for a centered square image and 75% for information.");
assert(card.includes('justifyContent:"center"')&&card.includes('imageColumn'),
  "Image must stay vertically centered when content height expands.");
assert(card.includes('styles.actions')&&card.includes('flexDirection:isRTL?"row-reverse":"row"'),
  "Details and reserve buttons must be horizontal and RTL-aware.");
assert(card.includes('minHeight:46')&&card.includes('styles.reserveButton')&&card.includes('styles.detailsButton'),
  "Buttons must be touch-friendly and distinguish primary vs secondary actions.");
assert(card.includes('onlineBookingEnabled!==false')&&card.includes('disabled={!canReserve}'),
  "Do not allow booking shortcuts from known paused venues.");
assert(card.includes('focusAvailability:"1"')&&card.includes('venueId:id'),
  "Reserve Online must open the selected venue's availability section, not place an order.");
assert(detail.includes('focusAvailability')&&detail.includes('scrollRef={availabilityScrollRef}')
  &&detail.includes('onLayout={onAvailabilityLayout}')&&screen.includes("scrollRef"),
  "Detail screen must honor booking deep links using the existing scroll view.");
assert(listing.includes('venues.map(venue=><VenueResultCard')
  &&listing.includes('imageUrl={venue.pageCoverImageUrl??venue.pageProfileImageUrl}')
  &&listing.includes('onlineBookingEnabled={venue.onlineBookingEnabled}'),
  "Venue search must use real cover images with profile fallback and booking status.");
assert(following.includes('venues.map(venue=><VenueResultCard')
  &&following.includes('imageUrl={venue.imageUrl}'),
  "Followed-venue directory must reuse the same card without modifying the top carousel.");
for(const key of ["booking.venueDetails","booking.reserveOnline","booking.onlineBookingUnavailable"]){
  assert(locales.split(`"${key}"`).length-1===3,`Missing English, Dari or Pashto for ${key}`);
}
console.log("Venue result cards verified: 25/75 layout, centered square image, live-booking shortcut, RTL, source images, localization and reuse.");
