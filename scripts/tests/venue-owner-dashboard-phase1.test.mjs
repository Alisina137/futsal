import assert from "node:assert/strict";
import {test} from "node:test";
import {
  ownerDashboardSections,ownerDashboardSubsections,ownerSectionForPath,
  ownerSectionRoot,ownerRememberableSectionRoute,ownerSecondaryRoute,
  ownerSubsectionRoute,
} from "../../apps/mobile/src/lib/owner-dashboard-navigation.ts";

test("venue owner has exactly seven ordered functional dashboard destinations",()=>{
  assert.deepEqual(ownerDashboardSections.map(x=>x.key),[
    "overview","bookings","schedule","competitions","media","analysis","settings",
  ]);
  assert.deepEqual(ownerDashboardSections.map(x=>x.href),[
    "/owner/overview","/owner/bookings","/owner/schedule",
    "/owner/competitions","/owner/posts","/owner/analytics","/owner/settings",
  ]);
  for(const item of ownerDashboardSections){
    assert.equal(ownerSectionRoot(item.key),item.href);
    assert.equal(ownerSectionForPath(item.href),item.key);
    assert.equal(ownerRememberableSectionRoute(item.href),item.href);
  }
  assert.equal(ownerSectionForPath("/dashboard"),"overview");
  assert.equal(ownerSectionForPath("/owner"),"overview");
  assert.equal(ownerSectionForPath("/owner/unknown"),"overview");
});

test("related booking/schedule, media and competition management screens focus the correct main tab",()=>{
  for(const path of ["/owner/schedule","/owner/timetable/weekly",
    "/owner/timetable/exceptions","/owner/manual-booking","/owner/block-time"]){
    assert.equal(ownerSectionForPath(path),"schedule",path);
  }
  for(const path of ["/owner/competitions","/owner/competitions/create",
    "/owner/competitions/cup-id/manage","/owner/manual-teams"]){
    assert.equal(ownerSectionForPath(path),"competitions",path);
  }
  for(const path of ["/owner/posts","/owner/posts/create","/owner/promotions",
    "/owner/promotions/create"]){
    assert.equal(ownerSectionForPath(path),"media",path);
  }
  for(const path of ["/owner/settings","/owner/subscription","/owner/referees",
    "/owner/onboarding"]){
    assert.equal(ownerSectionForPath(path),"settings",path);
  }
  assert.equal(ownerSectionForPath("/owner/bookings"),"bookings");
  assert.equal(ownerSectionForPath("/owner/analytics"),"analysis");
});

test("nested navigation contains only real existing functionality, not unimplemented placeholders",()=>{
  assert.deepEqual(ownerDashboardSubsections.competitions.map(x=>x.key),["all","offline"]);
  assert.deepEqual(ownerDashboardSubsections.media.map(x=>x.key),["posts","promotions","profile","reviews"]);
  assert.equal(ownerSecondaryRoute("/owner/competitions/abc/manage"),"competitions");
  assert.equal(ownerSecondaryRoute("/owner/manual-teams"),"competitions");
  assert.equal(ownerSecondaryRoute("/owner/promotions/create"),"media");
  assert.equal(ownerSecondaryRoute("/owner/bookings"),null);
  assert.equal(ownerSecondaryRoute("/owner/schedule"),null); // its dedicated timetable subnav persists
  assert.equal(ownerSubsectionRoute("/owner/manual-teams","competitions"),"offline");
  assert.equal(ownerSubsectionRoute("/owner/competitions/123/manage","competitions"),"all");
  assert.equal(ownerSubsectionRoute("/owner/promotions","media"),"promotions");
  assert.equal(ownerSubsectionRoute("/owner/posts/create","media"),"posts");
});

test("tab memory preserves only safe canonical section destinations",()=>{
  for(const path of ["/owner/manual-teams","/owner/promotions"]){
    assert.equal(ownerRememberableSectionRoute(path),path);
  }
  for(const path of ["/owner/competitions/abc/manage",
    "/owner/posts/create","/owner/subscription","/owner/manual-booking",
    "/owner/promotions/create"]){
    assert.equal(ownerRememberableSectionRoute(path),null,path);
  }
});

test("prefix-matching never confuses look-alike or unrelated routes",()=>{
  assert.equal(ownerSectionForPath("/owner/schedule-hijack"),"overview");
  assert.equal(ownerSectionForPath("/owner/bookings-extra"),"overview");
  assert.equal(ownerSectionForPath("/owner/promotions-copy"),"overview");
  assert.equal(ownerSecondaryRoute("/owner/manual-teams-extra"),null);
  assert.equal(ownerSecondaryRoute("/owner/competitions-copy"),null);
});
