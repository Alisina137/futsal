import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const directory=read("apps/mobile/app/(app)/(tabs)/venues.tsx");
const tile=read("apps/mobile/src/components/venues/FollowedVenueTile.tsx");
const resultCard=read("apps/mobile/src/components/venues/VenueResultCard.tsx");
const list=read("apps/mobile/app/(app)/venues/following.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const contract=read("packages/contracts/src/index.ts");
const repository=read("apps/api/src/modules/marketing/marketing.repository.ts");
const types=read("apps/api/src/modules/marketing/marketing.types.ts");
const routes=read("apps/api/src/modules/marketing/marketing.routes.ts");
const service=read("apps/api/src/modules/marketing/marketing.service.ts");
const tests=read("apps/api/test/marketing.test.ts");
const locales=read("packages/localization/src/index.ts");

assert(!directory.includes('t("booking.venuesTitle")')
  &&!directory.includes('t("booking.venuesSubtitle")'),
  "The primary Venues page must not display its previous title or subtitle.");
assert(directory.indexOf('testID="venue-followed-strip"')<
  directory.indexOf('testID="venue-name-location-search"'),
  "Followed venue carousel must come before the searchable venue/name/location directory.");
assert(directory.includes("const MAX_VISIBLE_FOLLOWS=10")
  &&directory.includes("followed.slice(0,MAX_VISIBLE_FOLLOWS)"),
  "Carousel must display no more than ten followed venue cards.");
assert(directory.includes("additionalCount>0")
  &&directory.includes('testID="venue-followed-show-more"')
  &&directory.includes('router.push("/venues/following")'),
  "Show more must be the last slide, only if a user follows more than ten venues.");
assert(directory.includes("preview.map(venue=><FollowedVenueTile"),
  "Only actual followed venue data may appear in the top carousel.");
assert(tile.includes("resolveMediaImageUrl(venue.imageUrl)")
  &&tile.includes("{venue.name}")
  &&tile.includes('pathname:"/venues/[venueId]"'),
  "Compact carousel cards need real logos and names that open venue details.");
assert(tile.includes('testID={`followed-venue-details-${venue.id}`}')
  &&tile.includes('testID={`followed-venue-reserve-${venue.id}`}')
  &&tile.includes('t("booking.venueDetails")')
  &&tile.includes('t("booking.reserveOnline")'),
  "Each followed venue tile must expose clearly labeled, separate details and reserve actions.");
assert(tile.includes('const openDetails=()=>router.push(')
  &&tile.includes('const openBooking=()=>router.push(')
  &&tile.includes('focusAvailability:"1"'),
  "Reserve Online must deep-link to availability and not book directly; details must remain a distinct action.");
assert(tile.includes('name={isRTL?"chevron-back":"chevron-forward"}')
  &&tile.includes("styles.detailsCue")
  &&tile.includes("styles.reserveButton")
  &&tile.includes("minHeight:44"),
  "The details affordance must be recognizable and RTL-aware; booking needs a clear accessible button.");
assert(tile.indexOf('style={styles.tile}')<tile.indexOf('testID={`followed-venue-details-')
  &&tile.indexOf("</Pressable>")<tile.indexOf('testID={`followed-venue-reserve-'),
  "The tile must use sibling touch targets so booking does not trigger venue details.");
assert(directory.includes('showMore:{width:148,minHeight:208'),
  "Show-more tile must align visually with the taller followed-venue cards.");
assert(directory.includes("useFocusEffect")&&list.includes("useFocusEffect")
  &&directory.includes("marketingApi.followedVenues")
  &&list.includes("marketingApi.followedVenues"),
  "Followed collections must refresh after a user follows/unfollows a venue.");
assert(directory.includes('flexDirection:isRTL?"row-reverse":"row"'),
  "Horizontal followed cards must preserve RTL ordering.");
assert(directory.includes("<Screen showHeader publicNav")&&list.includes("<Screen showHeader publicNav"),
  "Venues navigation remains shared across user roles.");
assert(list.includes("venues.map(venue=><VenueResultCard")&&list.includes("imageUrl={venue.imageUrl}")
  &&resultCard.includes('pathname:"/venues/[venueId]"')
  &&resultCard.includes("resolveMediaImageUrl(imageUrl)"),
  "Show-more destination must display every followed venue with its identity and shared venue card.");
assert(api.includes('request<FollowedVenuesResponse>("/api/v1/social/venues/followed",{},accessToken)'),
  "Followed venues cannot be guessed from the public venue search results.");
assert(contract.includes("followedVenueDtoSchema")&&contract.includes("followedVenuesResponseSchema"),
  "The followed venue API requires a typed public card payload.");
assert(types.includes("listFollowedVenues(userId: string)"),
  "Backend repository must fetch the authenticated account's real follows.");
assert(repository.includes("async listFollowedVenues(userId:string)")
  &&repository.includes("innerJoin(venues")
  &&repository.includes('eq(socialFollows.userId,userId)')
  &&repository.includes('eq(socialFollows.entityType,"VENUE")')
  &&repository.includes('eq(venues.status,"ACTIVE")'),
  "Follower data must be scoped to the signed-in user and visible venues.");
assert(service.includes("async followedVenues(userId:string)")
  &&routes.includes('router.get("/social/venues/followed",requireAuth(tokens)'),
  "Followed venue API must use authenticated GET and the existing marketing service.");
assert(tests.includes("returns all account-scoped followed venue cards")
  &&tests.includes("toHaveLength(12)")
  &&tests.includes("toHaveLength(10)")
  &&tests.includes("tokenB"),
  "Integration tests must cover zero/10/>10 follows, isolation and unfollows.");
for(const key of ["booking.followedVenues","booking.followedVenuesEmpty",
  "booking.followedLoadError","booking.followedShowMore",
  "booking.followedVenuesCount","booking.backToVenues"]){
  assert(locales.split(`"${key}"`).length-1===3,
    `Missing English/Dari/Pashto translation for ${key}`);
}
console.log("Followed Venues verified: no directory heading, authenticated 10-card RTL carousel, overflow-only Show more, complete collection page, focus refresh, logos, isolation and localization.");
