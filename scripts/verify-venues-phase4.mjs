import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const screen=read("apps/mobile/app/(app)/(tabs)/venues.tsx");
const location=read("apps/mobile/src/components/venues/useVenueMapLocation.ts");
const mapNative=read("apps/mobile/src/components/venues/NearbyVenuesMap.tsx");
const mapWeb=read("apps/mobile/src/components/venues/NearbyVenuesMap.web.tsx");
const reservations=read("apps/mobile/src/components/bookings/ReservationsPanel.tsx");
const locale=read("packages/localization/src/index.ts");
const nearby=read("apps/mobile/app/(app)/venues/nearby.tsx");
assert.ok(screen.includes('testID="venue-list-map-toggle"')&&
  screen.includes('testID={`venue-view-${mode}`}')&&
  screen.includes('accessibilityState={{selected:viewMode===mode}}')&&
  screen.includes('viewMode==="list"')&&screen.includes('viewMode==="map"'),
  "Main Venues page needs accessible Map/List toggle.");
assert.ok(screen.includes('testID="venue-directory-map"')&&
  screen.includes('mappedVenues=useMemo<NearbyVenueDto[]>')&&
  screen.includes("venues.flatMap(venue=>")&&
  screen.includes("!Number.isFinite(venue.latitude)")&&
  screen.includes("metrics[venue.id]?.distanceKm"),
  "Map must show exactly current filter results with verified real coordinates, not a separate unfiltered search.");
assert.ok(screen.includes("maxPins={25}")&&
  screen.includes('showOrigin={Boolean(geo.point||defaultPoint)}'),
  "Directory may show 25 pins, without falsely displaying a venue as the user's GPS location.");
assert.ok(screen.includes("setMapSelectedId(id)")&&
  screen.includes('testID="venue-map-selected-card"')&&
  screen.includes("<VenueResultCard id={mapSelected.id}")&&
  screen.includes("nextSlots={metrics[mapSelected.id]?.nextSlots}")&&
  screen.includes('www.google.com/maps/dir/?api=1&destination='),
  "Pin selection must surface the genuine booking preview, venue actions and navigation directions.");
assert.ok(screen.includes('setProvince("");')&&
  screen.includes('sort:"nearest" as const')&&
  screen.includes('void load(activeQuery,"",sorted);')&&
  screen.includes("activePoint.current??defaultPoint"),
  "Opt-in 'my location' must rank across provinces using real detected coordinates or saved fallback.");
assert.ok(location.includes("PermissionsAndroid.request(fine")&&
  location.includes('PermissionsAndroid.request(coarse)')&&
  location.includes('setTimeout(()=>fallback("timeout"),10_000)')&&
  location.includes('setSource("default")')&&
  location.includes('setSource("device")')&&
  location.includes("settled.current=true;cancelDeadline();"),
  "Foreground-only 10-second geolocation must explicitly handle permission, deadline and saved profile fallback.");
assert.ok(screen.includes('<NearbyDeviceLocation key={geo.attempt}')&&
  location.includes('setState("locating")')&&
  screen.includes("geo.state==="),
  "GPS probe must only mount while requested and permitted.");
for(const [label,html] of [["native",mapNative],["web",mapWeb]]){
  assert.ok(html.includes("maxPins=10,showOrigin=true")&&
    html.includes('venues.slice(0,Math.min(25,Math.max(1,maxPins)))')&&
    html.includes("if(model.showOrigin)")&&html.includes("label.textContent=venue.name"),
    label+" map must preserve ten-pin Nearby defaults and name/photo marker behavior.");
}
assert.ok(nearby.includes("venueApi.nearby(location.latitude,location.longitude)")&&
  nearby.includes("<NearbyVenuesMap")&&
  nearby.includes("setTimeout(()=>fallback(\"timeout\"),10_000)"),
  "Existing Nearby page must keep its dedicated 10 nearest results and live GPS fallback.");
assert.ok(reservations.includes('CANCELLED:{background:"#FFE4E6",ink:"#B42318"')&&
  reservations.includes('testID={group==="CANCELLED"?')&&
  reservations.includes('group==="CANCELLED"&&styles.cancelledCard')&&
  reservations.includes('group==="CANCELLED"&&styles.cancelledDetails')&&
  reservations.includes('cancelledCard:{backgroundColor:"#FFF1F2"')&&
  reservations.includes('cancelledDetails:{backgroundColor:"#FFE4E6"')&&
  reservations.includes('variant="danger"')&&
  reservations.includes('cancelHeading:{color:colors.danger}'),
  "Cancelled reservations, their badge, cancellation action and confirmation should use red theme.");
for(const key of ["mapView","listView","mapFilteredResults","mapPinCount","mapNoPins",
  "mapPinLimit","mapDirections","mapDirectionsError","mapProfilePosition"]){
  assert.equal(locale.split('"booking.'+key+'"').length,4,
    "Missing translated map label in English/Dari/Pashto: "+key);
}
console.log("Venues phase 4 passed: filtered Map/List, exact pin selection, Google directions, opt-in 10s GPS/default fallback, and red cancelled reservation theme.");
