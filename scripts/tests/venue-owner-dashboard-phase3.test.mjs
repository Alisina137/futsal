import assert from "node:assert/strict";
import {test} from "node:test";
import {
 ownerBookingStatusOptions,ownerBookingStatusScope,ownerBookingStatusThemes,
 ownerBookingDisplayStatus,validBookingDay,ownerBookingDateFilter,
} from "../../apps/mobile/src/lib/owner-bookings.ts";
test("one search bar exposes five booking statuses without redundant navigations",()=>{
 assert.deepEqual(ownerBookingStatusOptions,["ALL","PENDING","CONFIRMED","HISTORY","CANCELLED"]);
 assert.equal(ownerBookingStatusScope("ALL"),"ALL");
 assert.equal(ownerBookingStatusScope("PENDING"),"ALL");
 assert.equal(ownerBookingStatusScope("CONFIRMED"),"ACTIVE");
 assert.equal(ownerBookingStatusScope("HISTORY"),"HISTORY");
 assert.equal(ownerBookingStatusScope("CANCELLED"),"ALL");
});
test("statuses have consistent semantic colors and expired confirmed bookings appear as History",()=>{
 assert.equal(ownerBookingStatusThemes.PENDING.text,"#92400E");
 assert.equal(ownerBookingStatusThemes.CANCELLED.text,"#B91C1C");
 for(const status of ownerBookingStatusOptions){
   assert.ok(ownerBookingStatusThemes[status].background.startsWith("#"));
   assert.ok(ownerBookingStatusThemes[status].border.startsWith("#"));
 }
 const now=Date.parse("2026-10-16T12:00:00Z");
 const row=(status,endsAt)=>({status,endsAt});
 assert.equal(ownerBookingDisplayStatus(row("CONFIRMED","2026-10-16T11:00:00Z"),now),"HISTORY");
 assert.equal(ownerBookingDisplayStatus(row("CONFIRMED","2026-10-16T12:00:00Z"),now),"HISTORY");
 assert.equal(ownerBookingDisplayStatus(row("CONFIRMED","2026-10-16T13:00:00Z"),now),"CONFIRMED");
 assert.equal(ownerBookingDisplayStatus(row("PENDING","2026-10-16T11:00:00Z"),now),"PENDING");
 assert.equal(ownerBookingDisplayStatus(row("CANCELLED","2026-10-16T11:00:00Z"),now),"CANCELLED");
});
test("strict YYYY-MM-DD validation rejects impossible, ambiguous and invalid dates",()=>{
 for(const day of ["2026-10-15","2028-02-29","2026-12-31"]){
   assert.equal(validBookingDay(day),true,day);
 }
 for(const day of ["2026-02-29","2026-02-30","2026-13-01","2026-00-09",
   "2026-10-32","2026-1-2","10/15/2026","", "bad"]){
   assert.equal(validBookingDay(day),false,day);
 }
});
test("date filters support open bounds and reject inverted ranges",()=>{
 assert.deepEqual(ownerBookingDateFilter("",""),{valid:true});
 assert.deepEqual(ownerBookingDateFilter("2026-10-01",""),{valid:true,from:"2026-10-01"});
 assert.deepEqual(ownerBookingDateFilter("","2026-10-15"),{valid:true,to:"2026-10-15"});
 assert.deepEqual(ownerBookingDateFilter("2026-10-15","2026-10-15"),
   {valid:true,from:"2026-10-15",to:"2026-10-15"});
 assert.deepEqual(ownerBookingDateFilter("2026-10-16","2026-10-15"),{valid:false});
});
