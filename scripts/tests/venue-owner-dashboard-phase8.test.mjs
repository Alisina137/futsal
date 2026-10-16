import assert from "node:assert/strict";
import {test} from "node:test";
import {
 ownerDashboardSections,ownerDashboardSubsections,
 ownerSectionForPath,ownerSectionRoot,ownerRememberableSectionRoute,
 ownerSecondaryRoute,ownerSubsectionRoute,
} from "../../apps/mobile/src/lib/owner-dashboard-navigation.ts";
import {ownerCalendarSelectionMatches} from "../../apps/mobile/src/lib/owner-schedule-management.ts";
import {ownerBookingDateFilter,ownerBookingStatusOptions} from "../../apps/mobile/src/lib/owner-bookings.ts";
import {validateOwnerAnalyticsRange} from "../../apps/mobile/src/lib/owner-analytics-filters.ts";

test("all seven owner sections and canonical destinations stay stable",()=>{
 assert.deepEqual(ownerDashboardSections.map(x=>x.key),
  ["overview","bookings","schedule","competitions","media","analysis","settings"]);
 for(const section of ownerDashboardSections){
  assert.equal(ownerSectionForPath(section.href),section.key);
  assert.equal(ownerSectionRoot(section.key),section.href);
  assert.equal(ownerRememberableSectionRoute(section.href),section.href);
 }
 assert.deepEqual(ownerBookingStatusOptions,["ALL","PENDING","CONFIRMED","HISTORY","CANCELLED"]);
});
test("cross-section operational deep links activate the owning dashboard tab",()=>{
 const groups={
  overview:["/dashboard","/owner","/owner/overview"],
  bookings:["/owner/bookings"],
  schedule:["/owner/schedule","/owner/manual-booking","/owner/timetable/weekly",
   "/owner/timetable/exceptions","/owner/timetable/edit",
   "/owner/block-time","/owner/blocks"],
  competitions:["/owner/competitions","/owner/manual-teams",
   "/owner/competitions/create","/owner/competitions/id/manage"],
  media:["/owner/posts","/owner/posts/create","/owner/promotions",
   "/owner/promotions/create","/owner/media-profile","/owner/media-reviews"],
  analysis:["/owner/analytics"],
  settings:["/owner/settings","/owner/onboarding","/owner/subscription","/owner/referees"],
 };
 for(const [section,paths] of Object.entries(groups))
  for(const path of paths)assert.equal(ownerSectionForPath(path),section,path);
});
test("the two nested owner sections restore only real canonical destinations",()=>{
 assert.deepEqual(ownerDashboardSubsections.competitions.map(x=>x.key),["all","offline"]);
 assert.deepEqual(ownerDashboardSubsections.media.map(x=>x.key),
  ["posts","promotions","profile","reviews"]);
 for(const section of ["competitions","media"]){
  for(const option of ownerDashboardSubsections[section]){
   assert.equal(ownerSecondaryRoute(option.href),section);
   assert.equal(ownerSubsectionRoute(option.href,section),option.key);
   assert.equal(ownerRememberableSectionRoute(option.href),option.href);
  }
 }
 for(const path of [
  "/owner/competitions/some-id/manage","/owner/promotions/create",
  "/owner/posts/create","/owner/manual-booking","/owner/block-time",
  "/owner/subscription","/owner/competitions/create","/owner/referees",
  "/owner/media-profile/stranger",
 ])assert.equal(ownerRememberableSectionRoute(path),null,path);
 for(const lookalike of ["/owner/competitions-clone","/owner/posts-clone",
   "/owner/manual-teams-clone","/owner/settings-clone","/owner/media-reviews-clone"]){
  assert.equal(ownerSectionForPath(lookalike),"overview");
  assert.equal(ownerSecondaryRoute(lookalike),null);
 }
});
test("venue owner calendar data cannot be reused across actor, court, date, view or window",()=>{
 const requested={token:"owner-a-token",areaId:"court-A",view:"DAY",
  anchorDate:"2026-10-15",from:"2026-10-15",to:"2026-10-15"};
 assert.equal(ownerCalendarSelectionMatches(null,requested),false);
 assert.equal(ownerCalendarSelectionMatches({...requested},requested),true);
 const differences={
  token:"owner-b-token",areaId:"court-B",view:"WEEK",anchorDate:"2026-10-16",
  from:"2026-10-14",to:"2026-10-16",
 };
 for(const [key,value] of Object.entries(differences)){
  assert.equal(ownerCalendarSelectionMatches({...requested,[key]:value},requested),false,key);
 }
 assert.equal(ownerCalendarSelectionMatches({...requested,areaId:null}, {...requested,areaId:null}),true);
 assert.equal(ownerCalendarSelectionMatches({...requested,areaId:"court-A"},
  {...requested,areaId:null}),false);
});
test("booking query and analytics must reject invalid date scopes instead of showing zero activity",()=>{
 assert.deepEqual(ownerBookingDateFilter("2026-10-16","2026-10-15"),{valid:false});
 assert.deepEqual(ownerBookingDateFilter("2026-02-29",""),{valid:false});
 assert.equal(validateOwnerAnalyticsRange("2026-10-15","2026-10-16","2026-10-15"),"FUTURE");
 assert.equal(validateOwnerAnalyticsRange("2026-10-16","2026-10-15","2026-10-15"),"INVERTED");
 assert.equal(validateOwnerAnalyticsRange("2026-10-15","2026-10-15","2026-10-15"),null);
});
