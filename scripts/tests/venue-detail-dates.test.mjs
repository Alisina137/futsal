import assert from "node:assert/strict";
import {test} from "node:test";
import {isValidVenueDay,isVenueBookingDay,venueDayKey} from
  "../../apps/mobile/src/lib/venue-detail-dates.ts";

test("Kabul local date is not UTC date near midnight",()=>{
  assert.equal(venueDayKey("Asia/Kabul",new Date("2026-10-14T20:00:00Z")),"2026-10-15");
  assert.equal(venueDayKey("Asia/Kabul",new Date("2026-10-14T19:29:59Z")),"2026-10-14");
});
test("other venue timezone controls date and missing zone has safe Kabul fallback",()=>{
  const now=new Date("2026-10-14T01:00:00Z");
  assert.equal(venueDayKey("America/Los_Angeles",now),"2026-10-13");
  assert.equal(venueDayKey("Invalid/Zone",now),"2026-10-14");
});
test("invalid dates and leap-day errors are rejected",()=>{
  for(const date of ["2026-02-29","2026-04-31","2026-2-08","2026-13-01",
    "hello","2026-00-01","2026-10-14T08:00:00Z"])
    assert.equal(isValidVenueDay(date),false,date);
  assert.equal(isValidVenueDay("2028-02-29"),true);
});
test("inclusive booking advance window cannot overflow calendar/month/year",()=>{
  assert.equal(isVenueBookingDay("2027-01-01","2026-12-31",1),true);
  assert.equal(isVenueBookingDay("2027-01-02","2026-12-31",1),false);
  assert.equal(isVenueBookingDay("2026-12-30","2026-12-31",30),false);
  assert.equal(isVenueBookingDay("2026-02-29","2026-02-27",3),false);
  assert.equal(isVenueBookingDay("2026-12-31","2026-12-31",0),true);
  assert.equal(isVenueBookingDay("2027-01-01","2026-12-31",-1),false);
});
