import test from "node:test";
import assert from "node:assert/strict";
import {
  refereeKabulDay,refereeShiftDay,refereeWeekStart,
  refereeCalendarMonthKey,refereeCalendarIncludes,refereeCalendarMove,
  refereeCalendarWeekDays,refereeAvailabilityPreview,
} from "../../apps/mobile/src/lib/referee-calendar.ts";
import {
  formatRefereeScheduleParts,formatRefereeCalendarPeriod,
} from "../../apps/mobile/src/lib/date-time.ts";

const persian=new Intl.DateTimeFormat("fa-AF",{calendar:"persian"})
  .resolvedOptions().calendar==="persian";
const utc=value=>new Date(value).toISOString();
const profile=(weeklyAvailability=[],exceptions=[])=>({weeklyAvailability,exceptions});
const match=(start,end)=>({startsAt:utc(start),endsAt:utc(end)});

test("Kabul date is determined from local midnight, not the UTC date",()=>{
  assert.equal(refereeKabulDay("2026-10-16T18:59:59Z"),"2026-10-16");
  assert.equal(refereeKabulDay("2026-10-16T19:30:00Z"),"2026-10-17");
  assert.equal(refereeKabulDay("not-a-date"),null);
  assert.equal(refereeShiftDay("2026-12-31",1),"2027-01-01");
  assert.equal(refereeShiftDay("not-a-date",1),"not-a-date");
});
test("Dari/Pashto weeks start on Saturday; English weeks on Monday",()=>{
  assert.equal(refereeWeekStart("2026-10-17","fa-AF"),"2026-10-17");
  assert.equal(refereeWeekStart("2026-10-17","ps-AF"),"2026-10-17");
  assert.equal(refereeWeekStart("2026-10-17","en"),"2026-10-12");
  assert.equal(refereeCalendarWeekDays("2026-10-20","ps-AF")[0],"2026-10-17");
  assert.equal(refereeCalendarWeekDays("2026-10-20","en")[6],"2026-10-25");
  assert.equal(refereeCalendarIncludes("2026-03-21T06:00:00Z","2026-03-20","week","fa-AF"),false);
  assert.equal(refereeCalendarIncludes("2026-03-21T06:00:00Z","2026-03-20","week","en"),true);
});
test("Calendar day/week/month filtering uses a Kabul-local date",()=>{
  assert.equal(refereeCalendarIncludes("2026-10-16T20:00:00Z","2026-10-17","day","en"),true);
  assert.equal(refereeCalendarIncludes("2026-10-16T18:00:00Z","2026-10-17","day","en"),false);
  assert.equal(refereeCalendarIncludes("garbled","2026-10-17","month","en"),false);
  assert.equal(refereeCalendarIncludes("2026-10-17T00:00:00Z","2026-09-17","month","en"),false);
});
test("Solar Hijri month changes at Nowruz, not at Gregorian month end",{
  skip:!persian,
},()=>{
  assert.equal(refereeCalendarMonthKey("2026-03-20","fa-AF"),"1404-12");
  assert.equal(refereeCalendarMonthKey("2026-03-21","fa-AF"),"1405-01");
  assert.equal(refereeCalendarMonthKey("2026-03-21","ps-AF"),"1405-01");
  assert.equal(refereeCalendarIncludes("2026-03-20T09:00:00Z","2026-03-21","month","fa-AF"),false);
  assert.equal(refereeCalendarIncludes("2026-03-20T09:00:00Z","2026-03-21","month","en"),true);
  assert.equal(refereeCalendarMonthKey(refereeCalendarMove("2026-03-20","month",1,"fa-AF"),"fa-AF"),"1405-01");
});
test("Calendar movement clamps month endings and preserves whole-week jumps",()=>{
  assert.equal(refereeCalendarMove("2026-01-31","month",1,"en"),"2026-02-28");
  assert.equal(refereeCalendarMove("2028-01-31","month",1,"en"),"2028-02-29");
  assert.equal(refereeCalendarMove("2026-03-21","month",-1,"en"),"2026-02-21");
  assert.equal(refereeCalendarMove("2026-10-17","week",1,"ps-AF"),"2026-10-24");
  assert.equal(refereeCalendarMove("2026-10-17","day",-1,"en"),"2026-10-16");
  assert.equal(refereeCalendarMove("2026-10-17","month",25,"en"),"2026-10-17");
});
test("Referee date labels use language-specific calendars and always show AM/PM",{
  skip:!persian,
},()=>{
  const date="2026-03-21T08:00:00Z";
  const english=formatRefereeScheduleParts(date,"en");
  const dari=formatRefereeScheduleParts(date,"fa-AF");
  const pashto=formatRefereeScheduleParts(date,"ps-AF");
  assert.match(english.date,/2026/);
  assert.match(dari.date,/۱۴۰۵|1405/);
  assert.match(pashto.date,/۱۴۰۵|1405/);
  assert.match(dari.time,/AM|PM/);
  assert.doesNotMatch(dari.time,/GMT|UTC|\+04/);
  assert.match(formatRefereeCalendarPeriod(new Date(date),"month","fa-AF"),/۱۴۰۵|1405/);
  assert.match(formatRefereeCalendarPeriod(new Date(date),"month","en"),/2026/);
});
test("Availability preflight mirrors server exceptions and weekly hours",()=>{
  const saturday=profile([{day:6,start:"09:00",end:"12:00"}]);
  const morning=match("2026-10-17T05:30:00Z","2026-10-17T06:30:00Z");
  const afternoon=match("2026-10-17T08:00:00Z","2026-10-17T09:00:00Z");
  assert.equal(refereeAvailabilityPreview(morning,saturday),"AVAILABLE");
  assert.equal(refereeAvailabilityPreview(afternoon,saturday),"UNAVAILABLE");
  assert.equal(refereeAvailabilityPreview(morning,profile(saturday.weeklyAvailability,
    [{date:"2026-10-17",available:false}])),"UNAVAILABLE");
  assert.equal(refereeAvailabilityPreview(afternoon,profile(saturday.weeklyAvailability,
    [{date:"2026-10-17",available:true}])),"AVAILABLE");
  // Phase 7: a paused referee or an empty weekly schedule cannot accept assignments.
  assert.equal(refereeAvailabilityPreview(morning,profile()),"UNAVAILABLE");
  assert.equal(refereeAvailabilityPreview(morning,{...saturday,acceptingAssignments:false}),"UNAVAILABLE");
  assert.equal(refereeAvailabilityPreview({startsAt:morning.startsAt,endsAt:null},saturday),
    "MISSING_SCHEDULE");
});
test("Availability does not invent permissions for overnight matches",()=>{
  const overnight=match("2026-10-17T18:30:00Z","2026-10-17T20:30:00Z");
  assert.equal(refereeAvailabilityPreview(overnight,profile()),"UNAVAILABLE");
  assert.equal(refereeAvailabilityPreview(match(
    "2026-10-17T07:00:00Z","2026-10-17T06:30:00Z"),profile()),
    "MISSING_SCHEDULE");
});
