import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const screen=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const nav=read("apps/mobile/src/lib/venue-detail-navigation.ts");
const sub=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");

for(const fragment of [
  "setNavigation(current=>switchVenueMain(current,id,target))",
  "setNavigation(current=>switchVenueSub(current,main,item",
  'chooseMain("about","location")',
  'chooseMain("updates","alerts")',
  'chooseMain("reserve","slots")',
  'switchVenueMain(current,"reserve","slots")',
  'switchVenueMain(current,"about","reviews")',
  'setNavigation(initialVenueNavigation(bookingDeepLink,reviewBookingId))',
  'testID={"venue-main-tab-"+item.id}',
  'accessibilityState={{selected:active}}',
  'testID={"venue-subtab-"+main+"-"+item}',
  "mainNav.focus(id,true)","subNav.focus(item,true)",
  'flexDirection:isRTL?"row-reverse":"row"',
]){
  assert.ok(screen.includes(fragment),"Missing Phase 1 venue navigation invariant: "+fragment);
}
assert.ok(!screen.includes("setMain(")&&!screen.includes("setSub("),
  "Main and subtab selection must be managed by the same navigation transition.");
for(const fragment of [
  'main:bookingDeepLink?"reserve":reviewBookingId?"about":"media"',
  'reserve:"slots",competitions:"upcoming"',
  'return {main,sub:target?{...current.sub,[main]:target}:current.sub}',
  'if(current.main!==main)return current',
])assert.ok(nav.includes(fragment),"Missing navigation state behavior: "+fragment);

for(const fragment of [
  "const requestId=++venueLoadSequence.current",
  "if(requestId!==venueLoadSequence.current)return",
  "if(result.venue.id!==targetId)throw",
  "return()=>{venueLoadSequence.current+=1;}",
  "venue.id!==targetId",
  "followActionSequence.current+=1",
  "if(actionId===followActionSequence.current)",
  "setFollowState(null);setFollowBusy(false);setFollowError(null)",
])assert.ok(screen.includes(fragment),"Missing stale-request/identity safeguard: "+fragment);

for(const tab of ["media","reserve","competitions","updates","about"])
  assert.ok(sub.includes('{id:"'+tab+'"'),"Missing existing main tab "+tab);
assert.ok(sub.includes('reserve:["slots","offers","bookings"]')&&
  sub.includes('about:["overview","facilities","location","reviews","preferences"]'),
  "Phase 1 must preserve existing subtabs and behavior.");
assert.ok(!screen.includes("scrollTo({y:0")&&!screen.includes("scrollToEnd("),
  "Main tab navigation must not scroll the parent page vertically.");
console.log("Venue Detail Phase 1 verified: preserved subtabs, exact shortcut targets, scoped async state, RTL focus and accessible tabs.");
