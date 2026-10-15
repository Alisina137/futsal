import assert from "node:assert/strict";
import {test} from "node:test";
import {venuePickerMonthDays,venuePickerCanMoveMonth} from "../../apps/mobile/src/lib/venue-reserve-date-picker.ts";
import {moveView} from "../../apps/mobile/src/lib/timetable-calendar.ts";

test("date grid has six complete weeks, bounded selectable booking days",()=>{
  const days=venuePickerMonthDays("2026-10-15","2026-10-15",3,"en");
  assert.equal(days.length,42);
  assert.deepEqual(days.filter(d=>d.enabled).map(d=>d.date),
    ["2026-10-15","2026-10-16","2026-10-17","2026-10-18"]);
  assert.equal(days.find(d=>d.date==="2026-10-14")?.enabled,false);
  assert.equal(days.find(d=>d.date==="2026-10-19")?.enabled,false);
});
test("month navigation clamps availability without hiding valid adjacent month",()=>{
  assert.equal(venuePickerCanMoveMonth("2026-10-15",-1,"2026-10-15",60,"en"),false);
  assert.equal(venuePickerCanMoveMonth("2026-10-15",1,"2026-10-15",60,"en"),true);
  assert.equal(venuePickerCanMoveMonth("2026-10-31",1,"2026-10-31",1,"en"),true);
  assert.equal(venuePickerCanMoveMonth("2026-10-31",1,"2026-10-31",0,"en"),false);
  assert.equal(venuePickerCanMoveMonth("2026-10-15",1,"2026-10-15",3,"en"),false);
});
test("leap-year dates, year rollover and non-English calendars retain Gregorian API keys",()=>{
  for(const language of ["en","fa-AF","ps-AF"]){
    const days=venuePickerMonthDays("2028-02-29","2028-02-28",2,language);
    assert.equal(days.find(d=>d.date==="2028-02-29")?.enabled,true,language);
    assert.equal(days.some(d=>d.date==="2028-02-30"),false,language);
  }
  const crossover=venuePickerMonthDays("2027-01-01","2026-12-31",1,"en");
  assert.deepEqual(crossover.filter(d=>d.enabled).map(d=>d.date),
    ["2026-12-31","2027-01-01"]);
  const persian=venuePickerMonthDays("2026-10-15","2026-10-15",30,"fa-AF");
  assert.equal(persian.filter(d=>d.currentMonth).length>=29,true);
  assert.equal(persian.some(d=>d.date==="2026-10-15"&&d.enabled),true);
});
