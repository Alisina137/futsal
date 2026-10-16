import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const dash=read("apps/mobile/src/components/player/PlayerDashboard.tsx");
const activity=read("apps/mobile/src/components/player/PlayerActivityTabs.tsx");
const career=read("apps/mobile/src/components/player/PlayerCareerTabs.tsx");
const translations=read("packages/localization/src/index.ts");
const main=dash.slice(dash.indexOf("const sections:"),dash.indexOf("const emptyPreferences:"));
const tabs=[...main.matchAll(/\{id:"([a-z]+)",icon:/g)].map(x=>x[1]);
assert.deepEqual(tabs,["overview","teams","activity","career","settings"]);
for(const nested of ["competitions","matches","schedule","bookings"])
  assert.ok(dash.includes('{id:"'+nested+'",icon:'),
    "Missing preserved Activity subtab "+nested);
for(const nested of ["statistics","achievements","history"])
  assert.ok(dash.includes('{id:"'+nested+'",icon:'),
    "Missing preserved Career subtab "+nested);
for(const marker of [
  'testID={"player-"+kind+"-subnavigation"}',
  'accessibilityState={{selected:selected===item.id}}',
  'useVisibleTab<T>(selected)','flexDirection:isRTL?"row-reverse":"row"',
  'tab==="activity"?<SectionNavigation',
  'tab==="career"?<SectionNavigation',
  '<PlayerActivityTabs tab={activityTab}',
  '<PlayerCareerTabs tab={careerTab}',
  'const [activityTab,setActivityTab]=useState<ActivityTab>("competitions")',
  'const [careerTab,setCareerTab]=useState<CareerTab>("statistics")',
  'setLoadedActor(null);setData(null);setDirectory([])',
  'const data=loadedActor===session?.user.id?storedData:null',
])assert.ok(dash.includes(marker),"Player Phase 1 navigation/scope missing "+marker);
assert.ok(!dash.includes('const moreTabs:')&&!dash.includes('tab==="more"'),
  "The former More menu must not remain in main player navigation");
for(const marker of [
  'tab==="statistics"','tab==="achievements"','tab==="history"',
  'testID="player-career-history"',
  'playerCareerApi.mine(token)',
])assert.ok(career.includes(marker),"Player Career feature inaccessible: "+marker);
for(const marker of [
  'void playerActivityApi.list(token).then(items=>',
  'void bookingApi.mine(token).then(result=>',
  'setActivityError(','setBookingError(',
  'activityActor===token?storedData:null',
  'bookingActor===token?storedBookings:[]',
  'tab==="schedule"&&bookingError',
  '(tab==="bookings"?bookingActor===token:!!data)',
  'teamOperationsApi.rsvp(token,activity.teamId,activity.id,availability)',
  'bookingApi.cancel(token,b.id)',
])assert.ok(activity.includes(marker),"Player Phase 1 independent loading regression: "+marker);
assert.ok(!activity.includes('Promise.all([playerActivityApi.list(token),bookingApi.mine(token)])'),
  "An optional booking failure must not blank the player activities page");
for(const key of ["activity","career","history","competitions","matches",
  "schedule","bookings","statistics","achievements"]){
  assert.equal(translations.split('"pd1.tab.'+key+'"').length-1,3,
    "Missing Player nav label in English, Dari, Pashto: "+key);
}
assert.equal(translations.split('"pd1.bookingPartialWarning"').length-1,3,
  "Booking degraded-mode warning must be localized in three languages");
console.log("Player Dashboard new Phase 1 verified: five-tab navigation, restored nested tabs, account isolation, independent activity/booking loading and RTL localization.");
