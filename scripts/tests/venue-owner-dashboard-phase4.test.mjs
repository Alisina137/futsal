import assert from "node:assert/strict";
import {test} from "node:test";
import {
  validOwnerScheduleDate,validOwnerBlockInterval,
  filteredOwnerCalendarDays,ownerBlockedEvents,ownerBlockOverlaps,
} from "../../apps/mobile/src/lib/owner-schedule-management.ts";

const block=(id,start,end,areaId="court-1")=>({
  id,type:"BLOCKED",areaId,areaName:"Court A",startsAt:start,endsAt:end,
  title:"Maintenance",priceAfn:null,bookingStatus:null,
});
const booking=(id,start,end,type="ONLINE_BOOKING",areaId="court-1")=>({
  id,type,areaId,areaName:"Court A",startsAt:start,endsAt:end,
  title:"Reservation",priceAfn:1500,bookingStatus:"CONFIRMED",
});
const start="2026-10-15T08:00:00+04:30";
const end="2026-10-15T10:00:00+04:30";
const day=(date,events)=>({
  date,events,availableCount:4,bookedCount:1,manualCount:0,
  competitionCount:0,blockedCount:1,promotionCount:0,revenueAfn:500,closed:false,
});

test("block dates reject invalid days without relying on permissive Date.parse",()=>{
  for(const value of ["2026-10-15","2028-02-29","2026-12-31"])
    assert.equal(validOwnerScheduleDate(value),true,value);
  for(const value of ["2026-02-29","2026-02-30","2026-13-01",
    "2026-00-01","2026-12-32","2026-1-1","15/10/2026"])
    assert.equal(validOwnerScheduleDate(value),false,value);
});
test("blocked ranges require same-day real 24h clocks, positive duration",()=>{
  assert.equal(validOwnerBlockInterval("2026-10-15","09:00","10:30"),true);
  assert.equal(validOwnerBlockInterval("2026-10-15","09:00","09:00"),false);
  assert.equal(validOwnerBlockInterval("2026-10-15","12:00","11:00"),false);
  assert.equal(validOwnerBlockInterval("2026-10-15","25:00","26:00"),false);
  assert.equal(validOwnerBlockInterval("2026-02-30","09:00","10:00"),false);
});
test("status filtering limits displayed Week/Day events without corrupting authoritative summary",()=>{
  const original=day("2026-10-15",[
    booking("online",start,end),
    block("block",start,end),
  ]);
  const filtered=filteredOwnerCalendarDays([original],"BLOCKED");
  assert.deepEqual(filtered[0].events.map(e=>e.id),["block"]);
  assert.equal(filtered[0].bookedCount,1);
  assert.equal(filtered[0].availableCount,4);
  assert.equal(original.events.length,2);
  assert.deepEqual(filteredOwnerCalendarDays([original],"ALL")[0].events,original.events);
});
test("blocked-time directory uses only real BLOCKED occupancy and sorts across days",()=>{
  const a=block("old","2026-10-15T06:00:00Z","2026-10-15T07:00:00Z");
  const b=block("late","2026-10-17T09:00:00Z","2026-10-17T10:00:00Z");
  const results=ownerBlockedEvents([
    day("2026-10-17",[b,booking("reserved",start,end)]),
    day("2026-10-15",[a]),
  ]);
  assert.deepEqual(results.map(item=>item.event.id),["old","late"]);
  assert.deepEqual(results.map(item=>item.day),["2026-10-15","2026-10-17"]);
});
test("preflight detects confirmed/pending bookings, competition and independent block conflicts",()=>{
  const events=[
    booking("online",start,end),
    booking("competition",start,end,"COMPETITION"),
    block("block",start,end),
  ];
  const rangeStart=Date.parse("2026-10-15T09:00:00+04:30");
  const rangeEnd=Date.parse("2026-10-15T11:00:00+04:30");
  assert.equal(ownerBlockOverlaps(events,"court-1",rangeStart,rangeEnd),true);
  assert.equal(ownerBlockOverlaps(events,"court-2",rangeStart,rangeEnd),false);
  assert.equal(ownerBlockOverlaps([block("block",start,end)],"court-1",rangeStart,rangeEnd,"block"),false);
  assert.equal(ownerBlockOverlaps([booking("online",start,end)],"court-1",
    Date.parse(end),Date.parse("2026-10-15T11:00:00+04:30")),false);
});
test("preflight excludes promotional/available slots and includes shared-court competition occupancy",()=>{
  const promotion={...booking("offer",start,end),"type":"PROMOTION"};
  const available={...booking("available",start,end),"type":"AVAILABLE"};
  const shared={...booking("fixture",start,end,"COMPETITION"),areaId:null};
  const at=Date.parse(start);
  assert.equal(ownerBlockOverlaps([promotion,available],"court-1",at,Date.parse(end)),false);
  assert.equal(ownerBlockOverlaps([shared],"court-1",at,Date.parse(end)),true);
});
