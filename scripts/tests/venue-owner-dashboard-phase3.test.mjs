import assert from "node:assert/strict";
import {test} from "node:test";
import {
 ownerBookingScope,ownerBookingTabs,validBookingDay,ownerBookingDateFilter,
} from "../../apps/mobile/src/lib/owner-bookings.ts";
test("four stable Booking tabs preserve pending approval workflow",()=>{
 assert.deepEqual(ownerBookingTabs,["PENDING","UPCOMING","ALL","HISTORY"]);
 assert.equal(ownerBookingScope("PENDING"),null);
 assert.equal(ownerBookingScope("UPCOMING"),"UPCOMING");
 assert.equal(ownerBookingScope("ALL"),"ALL");
 assert.equal(ownerBookingScope("HISTORY"),"HISTORY");
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
