import assert from "node:assert/strict";
import {test} from "node:test";
import {
  ownerPromotionViews,ownerPromotionState,ownerPromotionsForView,ownerPromotionCounts,
  ownerPostViews,ownerHasPendingSchedule,ownerPostsForView,
} from "../../apps/mobile/src/lib/owner-media-marketing.ts";
import {
  ownerSectionForPath,ownerRememberableSectionRoute,ownerSecondaryRoute,
  ownerSubsectionRoute,ownerDashboardSubsections,
} from "../../apps/mobile/src/lib/owner-dashboard-navigation.ts";

const now=Date.parse("2026-10-15T10:00:00+04:30");
const iso=(diff)=>new Date(now+diff*3600000).toISOString();
const promo=(id,status,starts,ends,title="Discount")=>({
  id,status,startsAt:iso(starts),endsAt:iso(ends),title,
  areaName:"Court A",note:"Only one court",
});
const promos=[
  promo("current","ACTIVE",-2,2,"Evening offer"),
  promo("future","ACTIVE",5,7,"Weekend offer"),
  promo("outdated","ACTIVE",-8,-4,"Old offer"),
  promo("ended","EXPIRED",-12,-9,"Expired offer"),
  promo("closed","CLOSED",-3,6,"Stopped offer"),
];
test("promotion states distinguish future scheduled from stored ACTIVE and elapsed ACTIVE",()=>{
 assert.equal(ownerPromotionState(promos[0],now),"ACTIVE");
 assert.equal(ownerPromotionState(promos[1],now),"UPCOMING");
 assert.equal(ownerPromotionState(promos[2],now),"EXPIRED");
 assert.equal(ownerPromotionState(promos[3],now),"EXPIRED");
 assert.equal(ownerPromotionState(promos[4],now),"CLOSED");
});
test("promotion counts count every offer exactly once without inventing booking revenue",()=>{
 assert.deepEqual(ownerPromotionCounts(promos,now),{
  ALL:5,ACTIVE:1,UPCOMING:1,EXPIRED:2,CLOSED:1,
 });
 assert.deepEqual(ownerPromotionViews,["ALL","ACTIVE","UPCOMING","EXPIRED","CLOSED"]);
});
test("future promotions are sorted by earliest start; expired by newest, search is case-insensitive",()=>{
 assert.deepEqual(ownerPromotionsForView(promos,"UPCOMING",now).map(x=>x.id),["future"]);
 assert.deepEqual(ownerPromotionsForView(promos,"EXPIRED",now).map(x=>x.id),["outdated","ended"]);
 assert.deepEqual(ownerPromotionsForView(promos,"ALL",now,"WEEKEND").map(x=>x.id),["future"]);
 assert.deepEqual(ownerPromotionsForView(promos,"ACTIVE",now,"missing"),[]);
});
const post=(id,status,visibility,schedules,body)=>({
 id,status,visibility,schedules,body,
});
const waiting={id:"time",executedAt:null,cancelledAt:null};
const done={id:"done",executedAt:iso(-4),cancelledAt:null};
const cancelled={id:"cancel",executedAt:null,cancelledAt:iso(-3)};
const posts=[
 post("a","PUBLISHED","PUBLIC",[],"Afternoon matches"),
 post("b","PUBLISHED","PRIVATE",[],"Internal news"),
 post("c","UNPUBLISHED","PUBLIC",[],"Draft tournament"),
 post("d","UNPUBLISHED","PUBLIC",[waiting],"Scheduled photos"),
 post("e","PUBLISHED","FOLLOWERS",[done,cancelled],"Friends update"),
];
test("scheduled means pending unexecuted and uncancelled, not historical automation",()=>{
 assert.equal(ownerHasPendingSchedule(posts[3]),true);
 assert.equal(ownerHasPendingSchedule(posts[4]),false);
 assert.deepEqual(ownerPostViews,["ALL","PUBLISHED","DRAFT","SCHEDULED","PRIVATE"]);
});
test("post filtering preserves privacy, drafts, schedules and text search",()=>{
 assert.deepEqual(ownerPostsForView(posts,"PUBLISHED").map(x=>x.id),["a","e"]);
 assert.deepEqual(ownerPostsForView(posts,"PRIVATE").map(x=>x.id),["b"]);
 assert.deepEqual(ownerPostsForView(posts,"DRAFT").map(x=>x.id),["c"]);
 assert.deepEqual(ownerPostsForView(posts,"SCHEDULED").map(x=>x.id),["d"]);
 assert.deepEqual(ownerPostsForView(posts,"ALL","TOURNAMENT").map(x=>x.id),["c"]);
});
test("four marketing subtabs are real, deep links highlight media and safe roots remembered",()=>{
 assert.deepEqual(ownerDashboardSubsections.media.map(x=>x.key),
  ["posts","promotions","profile","reviews"]);
 for(const [route,key] of [
  ["/owner/posts","posts"],["/owner/promotions","promotions"],
  ["/owner/media-profile","profile"],["/owner/media-reviews","reviews"],
 ]){
  assert.equal(ownerSectionForPath(route),"media",route);
  assert.equal(ownerSecondaryRoute(route),"media",route);
  assert.equal(ownerSubsectionRoute(route,"media"),key,route);
  assert.equal(ownerRememberableSectionRoute(route),route);
 }
 assert.equal(ownerRememberableSectionRoute("/owner/posts/create"),null);
 assert.equal(ownerRememberableSectionRoute("/owner/promotions/create"),null);
 assert.equal(ownerSectionForPath("/owner/media-reviews-extra"),"overview");
 assert.equal(ownerSecondaryRoute("/owner/media-profile-mimic"),null);
});
