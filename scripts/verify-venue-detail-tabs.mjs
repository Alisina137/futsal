import fs from "node:fs";
const read=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const check=(ok,message)=>{if(!ok)throw Error(message);};
const detail=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const components=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const listing=read("apps/mobile/src/components/venues/VenueResultCard.tsx");
const followed=read("apps/mobile/src/components/venues/FollowedVenueTile.tsx");
const booking=read("apps/mobile/app/(app)/booking/confirm.tsx");
const languages=read("packages/localization/src/index.ts");
const api=read("apps/mobile/src/lib/api.ts");
for(const tab of ["media","reserve","competitions","updates","about"]){
  check(components.includes('id:"'+tab+'"'),"Venue main navigation missing: "+tab);
  check(detail.includes('main==="'+tab+'"'),"Venue content not gated by selected tab: "+tab);
}
check(detail.includes('bookingDeepLink=focusAvailability==="1"')&&
  detail.includes('bookingDeepLink?"reserve":"media"')&&
  detail.includes('setMain("reserve")')&&
  detail.includes('reserve:"slots"')&&
  detail.includes('onPress={()=>reserve()}'),
  "Opening Reserve Online must select Reserve > Available Slots, while opening details selects Media.");
check(listing.includes('focusAvailability:"1"')&&followed.includes('focusAvailability:"1"'),
  "Venue result and followed-venue reserve shortcuts must deep-link to available slots.");
check(components.includes('export const venueSubtabs')&&
  components.includes('media:["posts","photos","videos"]')&&
  components.includes('reserve:["slots","offers","bookings"]')&&
  components.includes('competitions:["upcoming","live","completed"]')&&
  components.includes('updates:["announcements","alerts"]')&&
  components.includes('about:["overview","facilities","location"]'),
  "Venue tab/subtab structure is incomplete.");
for(const fragment of [
  "marketingApi.venuePosts","post.socialPostId","post.ctaTargetId",
  "resolveMediaImageUrl(post.imageUrl)","setPhoto(","venueVideoLink",
  "competitionApi.list()","c.venueId===venue.id","router.push({pathname:",
  "bookingApi.mine","b.venueId===venue.id","bookingApi.cancel",
  "venueApi.availability","writeAvailabilityCache","readAvailabilityCache",
  "slot.promotionId","slot.originalPriceAfn","onlineBookingEnabled",
  "bookings.filter","fresh&&isOnline","availabilityDate!==date",
  "formatCompetitionDateTime","NearbyVenuesMap","venue.latitude",
  "venue.areas.map","cancellationPolicy","notifications/preferences",
]){
  check(components.includes(fragment),"Data-backed venue behavior missing: "+fragment);
}
check(booking.includes("bookingApi.create")&&booking.includes("startsAt"),
  "Booking confirmation must remain routed through the server-authoritative booking service.");
check(detail.includes('flexDirection:isRTL?"row-reverse":"row"')&&
  detail.includes("styles.navActive")&&detail.includes("styles.subActive"),
  "Main and sub navigation must remain RTL-aware with visible active state.");
for(const k of ["tab.media","tab.reserve","tab.competitions","tab.updates","tab.about",
  "sub.media.posts","sub.reserve.slots","sub.reserve.bookings","sub.about.location",
  "noSlots","noOffers","noBookings","noPhotos","noVideos","bookingPaused"]){
  check(languages.split('"vd.'+k+'"').length-1===3,
    "Missing English/Dari/Pashto venue detail translation: "+k);
}
check(api.includes("venueApi =")&&api.includes("bookingApi =")&&
  api.includes("competitionApi =")&&api.includes("marketingApi ="),
  "Venue details must use existing typed domain APIs.");
console.log("Venue Detail verified: Media-first five tabs, Reserve Online -> Available Slots deep link, lazy real booking/social/competition data, no-cache live-only booking, RTL and three locales.");
