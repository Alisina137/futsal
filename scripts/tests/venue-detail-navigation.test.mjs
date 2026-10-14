import assert from "node:assert/strict";
import {test} from "node:test";
import {initialVenueNavigation,switchVenueMain,switchVenueSub} from
  "../../apps/mobile/src/lib/venue-detail-navigation.ts";

test("new venue defaults to the first Media tab and default subtabs",()=>{
  assert.deepEqual(initialVenueNavigation(false),{
    main:"media",sub:{media:"posts",reserve:"slots",competitions:"upcoming",
      updates:"announcements",about:"overview"},
  });
});
test("reservation and review deep links choose the correct initial destinations",()=>{
  assert.equal(initialVenueNavigation(true).main,"reserve");
  assert.equal(initialVenueNavigation(false,"review-id").main,"about");
  assert.equal(initialVenueNavigation(false,"review-id").sub.about,"reviews");
  assert.equal(initialVenueNavigation(true,"review-id").sub.about,"overview");
});
test("main-tab navigation preserves earlier subtab selections",()=>{
  let nav=initialVenueNavigation(false);
  nav=switchVenueSub(nav,"media","photos");
  nav=switchVenueMain(nav,"about");
  nav=switchVenueSub(nav,"about","reviews");
  nav=switchVenueMain(nav,"reserve");
  nav=switchVenueSub(nav,"reserve","bookings");
  nav=switchVenueMain(nav,"media");
  assert.equal(nav.sub.media,"photos");
  nav=switchVenueMain(nav,"reserve");
  assert.equal(nav.sub.reserve,"bookings");
  nav=switchVenueMain(nav,"about");
  assert.equal(nav.sub.about,"reviews");
});
test("quick actions target Location, Alerts and Slots without erasing other choices",()=>{
  let nav=initialVenueNavigation(false);
  nav=switchVenueSub(nav,"media","videos");
  nav=switchVenueMain(nav,"about","location");
  assert.deepEqual([nav.main,nav.sub.about],["about","location"]);
  nav=switchVenueMain(nav,"updates","alerts");
  assert.deepEqual([nav.main,nav.sub.updates],["updates","alerts"]);
  nav=switchVenueMain(nav,"reserve","slots");
  assert.deepEqual([nav.main,nav.sub.reserve,nav.sub.media],["reserve","slots","videos"]);
});
test("a different venue has new default navigation, not the old venue's choices",()=>{
  const old=switchVenueMain(initialVenueNavigation(false),"about","reviews");
  const next=initialVenueNavigation(false);
  assert.deepEqual([next.main,next.sub.about],["media","overview"]);
  assert.deepEqual([old.main,old.sub.about],["about","reviews"]);
});
test("a subtab tap cannot select a subtab in an inactive main tab",()=>{
  const original=initialVenueNavigation(false);
  assert.equal(switchVenueSub(original,"about","reviews"),original);
});
