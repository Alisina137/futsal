import fs from "node:fs";

function read(path){
  return fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
}
function assert(value,message){
  if(!value)throw new Error(message);
}

const migration=read("packages/database/drizzle/0019_venue_booking_settings.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const schema=read("packages/database/src/schema.ts");
const contracts=read("packages/contracts/src/index.ts");
const ownerRoutes=read("apps/api/src/modules/owner/owner.routes.ts");
const ownerService=read("apps/api/src/modules/owner/owner.service.ts");
const ownerRepository=read("apps/api/src/modules/owner/owner.repository.ts");
const bookingService=read("apps/api/src/modules/booking/booking.service.ts");
const bookingRoutes=read("apps/api/src/modules/booking/booking.routes.ts");
const bookingRepository=read("apps/api/src/modules/booking/booking.repository.ts");
const timetableRepository=read("apps/api/src/modules/timetable/timetable.repository.ts");
const timetableService=read("apps/api/src/modules/timetable/timetable.service.ts");
const settingsPage=read("apps/mobile/app/(app)/owner/settings.tsx");
const ownerNav=read("apps/mobile/src/components/owner/OwnerTopNav.tsx");
const schedule=read("apps/mobile/app/(app)/owner/schedule.tsx");
const publicVenue=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const mobileApi=read("apps/mobile/src/lib/api.ts");
const localization=read("packages/localization/src/index.ts");
const mobilePackage=read("apps/mobile/package.json");
const mobileLock=read("pnpm-lock.yaml");
const venueWebMap=read("apps/mobile/src/components/owner/VenueLocationWebMap.tsx");
const browserMap=read("apps/mobile/src/components/owner/VenueLocationWebMap.web.tsx");
const nativeGoogle=read("apps/mobile/src/components/owner/VenueGoogleMap.native.tsx");
const webGoogle=read("apps/mobile/src/components/owner/VenueGoogleMap.web.tsx");
const bookingTests=read("apps/api/test/booking.test.ts");
const ownerTests=read("apps/api/test/owner.test.ts");

for(const marker of [
  "online_booking_enabled",
  "minimum_booking_notice_minutes",
  "maximum_advance_booking_days",
]){
  assert(migration.includes(marker),`Venue Settings migration missing: ${marker}`);
}
assert(journal.includes('"tag": "0019_venue_booking_settings"'),"Venue Settings migration must be registered.");

for(const marker of [
  "onlineBookingEnabled",
  "minimumBookingNoticeMinutes",
  "maximumAdvanceBookingDays",
]){
  assert(schema.includes(marker),`Venue schema missing booking control: ${marker}`);
}

for(const marker of [
  "ownerVenueSettingsUpdateRequestSchema",
  "ownerVenueSettingsDtoSchema",
  "onlineBookingEnabled",
  "minimumBookingNoticeMinutes",
  "maximumAdvanceBookingDays",
  "cancellationPolicy",
]){
  assert(contracts.includes(marker),`Venue Settings contract missing: ${marker}`);
}
assert(contracts.includes("publicVenueDtoSchema")&&contracts.includes("maximumAdvanceBookingDays"),"Customer-facing venue DTO must expose booking rules.");

for(const marker of [
  'router.get("/settings"',
  'router.patch("/settings"',
]){
  assert(ownerRoutes.includes(marker),`Venue Settings API route missing: ${marker}`);
}
for(const marker of [
  "getVenueSettings",
  "updateVenueSettings",
  "toVenueSettings",
  "identityLocked",
  "normalizeAfghanistanPhone",
]){
  assert(ownerService.includes(marker),`Venue Settings service missing: ${marker}`);
}
for(const marker of [
  "updateVenueSettings",
  "defaultSessionDurationMinutes",
  "basePriceAfn",
  "onlineBookingEnabled",
]){
  assert(ownerRepository.includes(marker),`Venue Settings persistence missing: ${marker}`);
}

for(const marker of [
  "ONLINE_BOOKING_PAUSED",
  "BOOKING_NOTICE_REQUIRED",
  "BOOKING_TOO_FAR_AHEAD",
  "minimumBookingNoticeMinutes",
  "maximumAdvanceBookingDays",
  "confirmOwnerBooking",
]){
  assert(bookingService.includes(marker),`Live booking-setting enforcement missing: ${marker}`);
}
assert(bookingRoutes.includes('"/bookings/:bookingId/confirm"'),"Owner approval route for pending bookings is missing.");
assert(bookingRepository.includes("confirmBooking")&&bookingRepository.includes('status:"CONFIRMED"'),"Pending booking confirmation persistence is missing.");
assert(timetableRepository.includes("bookingStatus")&&timetableService.includes("bookingStatus"),"Venue Time Table must carry pending booking state.");

assert(mobilePackage.includes('"react-native-maps": "1.27.2"'),"Venue Settings map picker dependency missing.");
assert(mobilePackage.includes('"react-native-webview": "13.16.1"')&&mobileLock.includes("react-native-webview@13.16.1:"),
  "Expo Go WebView map fallback dependency and lockfile are required.");
for(const marker of [
  'from "react-native-webview"',
  "leaflet@1.9.4",
  "tile.openstreetmap.org",
  "onMessage={receive}",
  'send("pick"',
  'send("error")',
  "Number.isFinite(latitude)",
  "onPick({latitude,longitude})",
]){
  assert(venueWebMap.includes(marker),`Map WebView fallback missing: ${marker}`);
}
const mapConfig=read("apps/mobile/app.config.js");
assert(mapConfig.includes("react-native-maps")&&mapConfig.includes("GOOGLE_MAPS_ANDROID_API_KEY"),"Standalone Android Google Maps build must support environment-provided key without hardcoding it.");

for(const marker of [
  'type Section="GENERAL"|"BOOKING"|"COURT"|"ACCESS"',
  "onlineBookingEnabled",
  "bookingMode",
  "minimumBookingNoticeMinutes",
  "maximumAdvanceBookingDays",
  "cancellationPolicy",
  'router.push("/owner/timetable/weekly")',
  'router.push("/owner/timetable/exceptions")',
  'router.push("/owner/subscription")',
  'router.push("/owner/posts")',
  'router.push("/owner/referees")',
]){
  assert(settingsPage.includes(marker),`Venue Settings mobile control missing: ${marker}`);
}
for(const marker of [
  "VenueGoogleMap",
  "onPress={openLocationPicker}",
  'accessibilityLabel={t("venueSettings.chooseOnMap")}',
  'coordinateMapButton',
  'styles.coordinateFields',
  'locationPickerOpen?<Modal',
  "onPick={acceptDraftPoint}",
  "setLatitude(String(next.latitude))",
  "setLongitude(String(next.longitude))",
  'editable={false}',
  'locationPickerOpen?<Modal',
  'openLocationPicker',
  'confirmLocation',
  'acceptDraftPoint',
  'setMapPoint(draftMapPoint)',
  'mapProvider==="OSM"',
  '<VenueLocationWebMap',
  'setMapProvider("OSM")',
  'mapWebUnavailable',
  'editDraftCoordinates',
  'value={draftLatitude}',
  'value={draftLongitude}',
  'disabled={!draftMapPoint}',
]){
  assert(settingsPage.includes(marker),`Venue map picker missing: ${marker}`);
}
const locationSection=settingsPage.slice(settingsPage.indexOf('<SectionTitle icon="location-outline"'),settingsPage.indexOf('section==="BOOKING"'));
assert(locationSection.indexOf('styles.coordinateFields')>=0
  && locationSection.indexOf("onPress={openLocationPicker}")>locationSection.indexOf('styles.coordinateFields'),
  "Google Maps button must appear NEXT TO latitude and longitude inputs.");
assert(settingsPage.includes('<VenueGoogleMap')&&settingsPage.indexOf("<VenueGoogleMap")>
    settingsPage.indexOf("locationPickerOpen?<Modal"),
  "Google Map must open in fullscreen modal, not consume Venue Settings layout.");
assert(!settingsPage.includes('from "react-native-maps"')
  &&!settingsPage.includes('from "react-native-webview"')
  &&settingsPage.includes('Platform.OS!=="web"'),
  "Expo Router eagerly loads settings on web: never import native maps or show unsupported Google map choice.");
for(const marker of ['from "react-native-maps"',"PROVIDER_GOOGLE",
  "DEFAULT_MAP_REGION","<MapView","<Marker","draggable",
  'onPress={(event)=>onPick(event.nativeEvent.coordinate)}',
  'onDragEnd={(event)=>onPick(event.nativeEvent.coordinate)}']){
  assert(nativeGoogle.includes(marker),`Android Google Map functionality missing: ${marker}`);
}
assert(!webGoogle.includes('from "react-native-maps"')
  &&webGoogle.includes("<VenueLocationWebMap"),
  "Browser Google fallback must never evaluate react-native-maps.");
assert(!browserMap.includes('from "react-native-webview"')
  &&browserMap.includes('createElement("iframe"')
  &&browserMap.includes('window.parent.postMessage')
  &&browserMap.includes('event.source!==frame.current?.contentWindow')
  &&browserMap.includes('sandbox:"allow-scripts"')
  &&browserMap.includes('if(parsed.type!=="pick"||readOnly||!parsed.point)return;'),
  "Browser venue picker must use a safe real Leaflet iframe without importing native WebView.");
const addressRow=settingsPage.slice(settingsPage.indexOf('<SectionTitle icon="business-outline"'),settingsPage.indexOf('<SectionTitle icon="call-outline"'));
assert(addressRow.includes('t("owner.address")')&&addressRow.includes('t("venueSettings.viewSavedAddress")')&&addressRow.includes('onPress={openSavedAddress}'),
  "General → Address must retain its label and expose a view-saved-address action.");
assert(!addressRow.includes('<ReadOnlyRow label={t("owner.address")} value={data.address}/>'),
  "Saved venue address should display on demand, not as a duplicate inline row.");
assert(settingsPage.includes('savedAddressOpen?<Modal')&&settingsPage.includes('value={data.address}')&&
  settingsPage.includes('value={data.province}')&&settingsPage.includes('value={data.city}'),
  "Read-only saved-address sheet must show the previously saved address and locality.");
assert(settingsPage.includes('initialPoint={savedMapCoordinate}')&&settingsPage.includes('readOnly')&&
  settingsPage.includes('onPress={()=>void openSavedPinInGoogleMaps()}')&&settingsPage.includes('data?.latitude'),
  "Saved-address location preview must use persisted coordinates rather than unsaved map drafts.");
assert(settingsPage.includes('savedAddressNoPin')&&settingsPage.includes('savedAddressMapUnavailable'),
  "Saved-address preview must handle missing pins and unavailable map tiles.");
assert(venueWebMap.includes('readOnly?:boolean')&&venueWebMap.includes('if(!${readOnly})map.on("click"')&&
  venueWebMap.includes('draggable:${!readOnly}'),
  "Saved-address map must disable marker changes while location edit map remains interactive.");
assert(settingsPage.includes('onPress={confirmLocation}')&&settingsPage.includes('setMapPoint(draftMapPoint)')&&
  settingsPage.includes('editDraftCoordinates(draftLatitude,value)')&&settingsPage.includes('editDraftCoordinates(value,draftLongitude)'),
  "Native/alternative map and manual coordinates must confirm into venue latitude and longitude.");
assert(ownerNav.includes('href:"/owner/settings"'),"Last Venue Owner tab must open the dedicated Venue Settings page.");
assert(!ownerNav.includes('labelKey:"owner.dashboardNav.settings",href:"/owner/onboarding"'),"Venue Settings tab must not route back to onboarding.");

assert(mobileApi.includes("ownerApi")&&mobileApi.includes("updateSettings")&&mobileApi.includes("confirmBooking"),"Mobile API must support Venue Settings and booking approval.");
assert(schedule.includes("schedule.approveBooking")&&schedule.includes("ownerApi.confirmBooking")&&schedule.includes('bookingStatus==="PENDING"'),"Pending online bookings must be approvable from Venue Time Table.");
assert(publicVenue.includes("venue.cancellationPolicy")&&publicVenue.includes("maximumAdvanceBookingDays"),"Public venue page must show customer-facing booking rules.");

for(const key of [
  "venueSettings.title",
  "venueSettings.section.GENERAL",
  "venueSettings.section.BOOKING",
  "venueSettings.section.COURT",
  "venueSettings.section.ACCESS",
  "venueSettings.acceptOnline",
  "venueSettings.approval",
  "venueSettings.minimumNotice",
  "venueSettings.advanceDays",
  "venueSettings.cancellationPolicy",
  "venueSettings.mapTapHint",
  "venueSettings.mapMarkerHint",
  "venueSettings.coordinatesSelected",
  "venueSettings.clearLocation",
  "venueSettings.chooseOnMap",
  "venueSettings.mapButton",
  "venueSettings.mapAlternative",
  "venueSettings.mapGoogle",
  "venueSettings.mapLoading",
  "venueSettings.mapUnavailable",
  "venueSettings.viewSavedAddress",
  "venueSettings.savedAddressTitle",
  "venueSettings.savedAddressDescription",
  "venueSettings.savedAddressPinTitle",
  "venueSettings.openSavedPinInGoogleMaps",
  "venueSettings.savedAddressNoPin",
  "venueSettings.savedAddressMapUnavailable",
  "venueSettings.savedAddressLinkError",
  "venueSettings.closeAddressPreview",
  "venueSettings.confirmOnMap",
  "venueSettings.cancelMapPicker",
  "venueSettings.mapPickSubtitle",
  "schedule.approveBooking",
  "schedule.pendingApproval",
]){
  const count=localization.split(`"${key}"`).length-1;
  assert(count===3,`Venue Settings localization missing ${key}; found ${count}.`);
}

assert(bookingTests.includes("pauses online booking without deleting existing venue inventory"),"Online booking pause regression test missing.");
assert(bookingTests.includes("supports owner approval mode from pending online booking to confirmed booking"),"Approval-mode regression test missing.");
assert(ownerTests.includes("loads and updates live Venue Settings without changing locked venue identity"),"Venue Settings persistence regression test missing.");

console.log("Venue Settings verified: dedicated settings tab, live online-booking controls, approval workflow, booking windows, cancellation policy, court/contact/location management, customer-visible rules, management shortcuts, localization, and regression coverage are present.");
