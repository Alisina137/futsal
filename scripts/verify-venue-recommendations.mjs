import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const assert=(truth,message)=>{if(!truth)throw new Error(message);};
const directory=read("apps/mobile/app/(app)/(tabs)/venues.tsx");
const popular=read("apps/mobile/app/(app)/venues/popular.tsx");
const nearby=read("apps/mobile/app/(app)/venues/nearby.tsx");
const nativeLocation=read("apps/mobile/src/components/venues/NearbyDeviceLocation.native.tsx");
const browserLocation=read("apps/mobile/src/components/venues/NearbyDeviceLocation.web.tsx");
const map=read("apps/mobile/src/components/venues/NearbyVenuesMap.tsx");
const contracts=read("packages/contracts/src/index.ts");
const bookService=read("apps/api/src/modules/booking/booking.service.ts");
const bookRoutes=read("apps/api/src/modules/booking/booking.routes.ts");
const markService=read("apps/api/src/modules/marketing/marketing.service.ts");
const markRepo=read("apps/api/src/modules/marketing/marketing.repository.ts");
const markRoutes=read("apps/api/src/modules/marketing/marketing.routes.ts");
const markTypes=read("apps/api/src/modules/marketing/marketing.types.ts");
const api=read("apps/mobile/src/lib/api.ts");
const btest=read("apps/api/test/booking.test.ts");
const mtest=read("apps/api/test/marketing.test.ts");
const language=read("packages/localization/src/index.ts");
const expo=read("apps/mobile/app.json");
assert(directory.includes('testID="venue-discovery-shortcuts"')
  &&directory.includes('testID="venue-most-followed-button"')
  &&directory.includes('testID="venue-nearby-button"')
  &&directory.includes('router.push("/venues/popular")')
  &&directory.includes('router.push("/venues/nearby")'),"Both discovery shortcuts must be below followed carousel.");
assert(directory.indexOf('testID="venue-followed-carousel"')<directory.indexOf('testID="venue-discovery-shortcuts"')
  &&directory.indexOf('testID="venue-discovery-shortcuts"')<directory.indexOf('testID="venue-name-location-search"'),
  "Shortcuts must be immediately below the followed cards and above search.");
assert(popular.includes("marketingApi.mostFollowedVenues()")
  &&popular.includes("venues.map((venue,index)")
  &&popular.includes("venue.followerCount")
  &&popular.includes("<VenueResultCard"),"Most followed page needs actual ranked counts and reusable venue cards.");
assert(contracts.includes("mostFollowedVenuesResponseSchema")
  &&contracts.includes("nearbyVenuesResponseSchema")
  &&api.includes("request<MostFollowedVenuesResponse>")
  &&api.includes("request<NearbyVenuesResponse>"),"Discovery needs typed DTOs and API methods.");
assert(markRepo.includes("async listVenueFollowerCounts(")
  &&markRepo.includes('eq(socialFollows.entityType,"VENUE")')
  &&markTypes.includes("listVenueFollowerCounts(")
  &&markService.includes("this.booking.listPublicVenues({})")
  &&markService.includes("b.followerCount-a.followerCount")
  &&markRoutes.includes('router.get("/social/venues/most-followed"'),"Popular must rank genuine follows within subscription-visible venues.");
assert(bookService.includes("async nearbyVenues(")
  &&bookService.includes("6371.0088")
  &&bookService.includes("venue.latitude===null||venue.longitude===null")
  &&bookService.includes("this.listPublicVenues({})")
  &&bookService.includes(".slice(0,10)")
  &&bookRoutes.includes('router.get("/nearby"')
  &&bookRoutes.indexOf('router.get("/nearby"')<bookRoutes.indexOf('router.get("/:venueId"'),
  "Nearby requires validated coordinates and Haversine ranking before /:venueId route.");
assert(nearby.includes("PermissionsAndroid.request")
  &&nearby.includes("<NearbyDeviceLocation")
  &&nativeLocation.includes("onUserLocationChange")
  &&browserLocation.includes("navigator.geolocation.getCurrentPosition")
  &&nearby.includes("setTimeout(()=>fallback(\"timeout\"),10_000)")
  &&nearby.includes("venueApi.nearby(")
  &&nearby.includes('testID="nearby-default-fallback"')
  &&nearby.includes('testID="nearby-selected-venue"')
  &&nearby.includes("<VenueResultCard"),"Nearby must use foreground geolocation with 10-second saved-location fallback and display selected venues.");
assert(map.includes("L.marker(")&&map.includes("L.tileLayer(")
  &&map.includes("bubble.appendChild(photo)")&&map.includes("label.textContent=venue.name")
  &&map.includes('send("select",venue.id)')&&map.includes("onSelect(data.id)")
  &&map.includes("model.venues.forEach"),"Pins must show photo/name above exact location and open a real selection.");
assert(expo.includes("ACCESS_FINE_LOCATION")&&expo.includes("NSLocationWhenInUseUsageDescription"),
  "Standalone Android/iOS must have explicit location permissions.");
assert(btest.includes("returns the nearest ten permitted venues")
  &&mtest.includes("ranks fifteen most-followed active entitled venues"),
  "Both recommendation routes need integration tests.");
for(const key of ["booking.mostFollowed","booking.venuesNearby","booking.followersCount",
  "booking.nearbyPermissionDenied","booking.nearbyEmpty","booking.nearbyMapUnavailable"]){
  assert(language.split(`"${key}"`).length===4,"Missing localized key: "+key);
}
console.log("Venue recommendations verified: followed shortcuts, real top 15 counts, nearest 10 geocoordinates, map media pins/selection, fallback location UX, localization and backend tests.");
