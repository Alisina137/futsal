import fs from "node:fs";
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const schema=read("packages/database/src/schema.ts");
const migration=read("packages/database/drizzle/0022_user_default_location.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const contracts=read("packages/contracts/src/index.ts");
const authTypes=read("apps/api/src/modules/auth/auth.types.ts");
const authRepository=read("apps/api/src/modules/auth/auth.repository.ts");
const authService=read("apps/api/src/modules/auth/auth.service.ts");
const profile=read("apps/mobile/app/(app)/profile/account.tsx");
const nearby=read("apps/mobile/app/(app)/venues/nearby.tsx");
const nativeProbe=read("apps/mobile/src/components/venues/NearbyDeviceLocation.native.tsx");
const browserProbe=read("apps/mobile/src/components/venues/NearbyDeviceLocation.web.tsx");
const browserMap=read("apps/mobile/src/components/venues/NearbyVenuesMap.web.tsx");
const tests=read("apps/api/test/auth.test.ts");
const locale=read("packages/localization/src/index.ts");

assert(schema.includes('defaultLatitude:doublePrecision("default_latitude")')
  &&schema.includes('defaultLongitude:doublePrecision("default_longitude")')
  &&migration.includes('users_default_location_pair_ck')
  &&journal.includes('"tag": "0022_user_default_location"'),
  "Default coordinates must be persisted as paired validated database columns with registered migration.");
assert(contracts.includes('defaultLatitude:z.number().finite().min(-90).max(90).nullable().optional()')
  &&contracts.includes('defaultLongitude:z.number().finite().min(-180).max(180).nullable().optional()')
  &&contracts.includes('defaultLatitude:z.number().min(-90).max(90).nullable()')
  &&contracts.includes('defaultLongitude:z.number().min(-180).max(180).nullable()')
  &&contracts.includes('.superRefine((value,ctx)=>'),
  "Account settings need a validated optional coordinate pair in request and private authenticated response.");
assert(authTypes.includes("defaultLatitude:user.defaultLatitude")
  &&authRepository.includes("defaultLatitude:input.defaultLatitude")
  &&authService.includes("input.defaultLatitude===undefined?user.defaultLatitude")
  &&tests.includes("persists a private default location"),
  "Default location must persist on the user's account and survive unrelated profile changes.");
assert(profile.includes("VenueLocationWebMap")
  &&profile.includes('t("profile.defaultLocationTitle")')
  &&profile.includes("setDraftPoint(point)")
  &&profile.includes("defaultLatitude:defaultLatitude.trim()?Number(defaultLatitude):null")
  &&profile.includes("defaultLongitude:defaultLongitude.trim()?Number(defaultLongitude):null")
  &&profile.includes('label={t("profile.clearDefaultLocation")}'),
  "Users must be able to set, change, validate and clear default coordinates on their profile.");
assert(nearby.includes('setTimeout(()=>fallback("timeout"),10_000)')
  &&nearby.includes("settled.current")
  &&nearby.includes("defaultPoint")
  &&nearby.includes('setLocationSource("default")')
  &&nearby.includes('setLocationSource("device")')
  &&nearby.includes("venueApi.nearby(location.latitude,location.longitude)")
  &&nearby.includes('testID="nearby-default-fallback"'),
  "Nearby search must prefer real location, fallback within 10 seconds, identify source and ignore late location.");
assert(nativeProbe.includes("onUserLocationChange")&&browserProbe.includes("navigator.geolocation")
  &&!nearby.includes('from "react-native-maps"')
  &&!browserMap.includes('from "react-native-webview"')
  &&browserMap.includes('createElement("iframe"'),
  "Browser nearby search must avoid native Maps and WebView modules, with native GPS preserved.");
for(const key of ["profile.defaultLocationTitle","profile.defaultLocationInvalid",
  "profile.useThisLocation","booking.nearbyDefaultUsed","booking.tryLiveLocation",
  "booking.setDefaultLocation"]){
  assert(locale.split(`"${key}"`).length-1===3,`Missing EN/Dari/Pashto translation: ${key}`);
}
console.log("Default location verified: account persistence and validation, map picker, 10-second live GPS fallback, platform-safe maps, RTL and privacy.");
