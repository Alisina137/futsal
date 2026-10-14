import fs from "node:fs";
const read=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const check=(ok,message)=>{if(!ok)throw Error(message);};
const detail=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const components=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const navigation=read("apps/mobile/src/lib/venue-detail-navigation.ts");
const listing=read("apps/mobile/src/components/venues/VenueResultCard.tsx");
const followed=read("apps/mobile/src/components/venues/FollowedVenueTile.tsx");
const booking=read("apps/mobile/app/(app)/booking/confirm.tsx");
const languages=read("packages/localization/src/index.ts");
const api=read("apps/mobile/src/lib/api.ts");
const venueCompetition=read("apps/mobile/src/components/venues/VenueCompetitionsPanel.tsx");
for(const tab of ["media","reserve","competitions","updates","about"]){
  check(components.includes('id:"'+tab+'"'),"Venue main navigation missing: "+tab);
  check(detail.includes('main==="'+tab+'"'),"Venue content not gated by selected tab: "+tab);
}
check(detail.includes('bookingDeepLink=focusAvailability==="1"')&&
  navigation.includes('main:bookingDeepLink?"reserve":reviewBookingId?"about":"media"')&&
  detail.includes('switchVenueMain(current,"reserve","slots")')&&
  navigation.includes('reserve:"slots"')&&
  detail.includes('onPress={()=>reserve()}'),
  "Opening Reserve Online must select Reserve > Available Slots, while opening details selects Media.");
check(listing.includes('focusAvailability:"1"')&&followed.includes('focusAvailability:"1"'),
  "Venue result and followed-venue reserve shortcuts must deep-link to available slots.");
check(components.includes('export const venueSubtabs')&&
  components.includes('media:["posts","photos","videos"]')&&
  components.includes('reserve:["slots","offers","bookings","saved"]')&&
  components.includes('competitions:["registration","upcoming","live","completed","matches"]')&&
  components.includes('updates:["announcements","schedule","alerts"]')&&
  components.includes('about:["overview","facilities","hours","location","reviews","policies"]'),
  "Venue tab/subtab structure is incomplete.");
for(const fragment of [
  "marketingApi.venuePosts","post.socialPostId","post.ctaTargetId",
  "resolveMediaImageUrl(post.imageUrl)","setPhoto(","venueVideoLink",
  "VenueCompetitionsPanel","VenueCompetitionsContent","router.push({pathname:",
  "bookingApi.mine","x.venueId===venue.id","bookingApi.cancel",
  "venueApi.availability","writeAvailabilityCache","readAvailabilityCache",
  "slot.promotionId","slot.originalPriceAfn","onlineBookingEnabled",
  "bookings.filter","!fresh||!isOnline","availabilityDate!==date",
  "NearbyVenuesMap","venue.latitude",
  "venue.areas.map","cancellationPolicy","notifications/preferences",
]){
  check(components.includes(fragment),"Data-backed venue behavior missing: "+fragment);
}
check(venueCompetition.includes("competitionApi.discover(queryFor(venue.id,sub,1))")&&
  venueCompetition.includes("competitionApi.venueMatches(venue.id,matchScope,1)")&&
  venueCompetition.includes('testID={"venue-match-"+match.id}'),
  "Competitions must use server-scoped paginated lists and real matches.");
check(booking.includes("bookingApi.create")&&booking.includes("startsAt"),
  "Booking confirmation must remain routed through the server-authoritative booking service.");
check(detail.includes('flexDirection:isRTL?"row-reverse":"row"')&&
  detail.includes("styles.navActive")&&detail.includes("styles.subActive")&&
  detail.includes("style={styles.subNavFrame}")&&
  detail.includes("subNav:{flexGrow:1")&&
  detail.includes("subItem:{flex:1,minWidth:112,minHeight:48"),
  "Main and evenly distributed sub-navigation must remain RTL-aware with visible active state.");
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
