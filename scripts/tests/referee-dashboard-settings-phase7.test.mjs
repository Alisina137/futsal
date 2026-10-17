import test from "node:test";
import assert from "node:assert/strict";
import {normalizeRefereeSettings,refereeSettingsChanged,refereeSettingsIssue,
  refereeExceptionMonth} from "../../apps/mobile/src/lib/referee-settings.ts";
import {refereeAvailabilityPreview} from "../../apps/mobile/src/lib/referee-calendar.ts";

const full=()=>({
  level:"Level 2",experienceYears:3,biography:"Local competitions",
  acceptingAssignments:true,
  weeklyAvailability:[{day:6,start:"09:00",end:"17:00"}],
  exceptions:[],
});
const match={startsAt:"2026-10-17T05:00:00Z",endsAt:"2026-10-17T06:00:00Z"};
test("Pausing assignments overrides weekly hours and special-date availability",()=>{
  assert.equal(refereeAvailabilityPreview(match,full()),"AVAILABLE");
  assert.equal(refereeAvailabilityPreview(match,{...full(),acceptingAssignments:false}),"UNAVAILABLE");
  assert.equal(refereeAvailabilityPreview(match,{...full(),acceptingAssignments:false,
    exceptions:[{date:"2026-10-17",available:true}]}),"UNAVAILABLE");
});
test("No weekly days deny invitations unless an explicit special date allows it",()=>{
  assert.equal(refereeAvailabilityPreview(match,{...full(),weeklyAvailability:[]}),"UNAVAILABLE");
  assert.equal(refereeAvailabilityPreview(match,{...full(),weeklyAvailability:[],
    exceptions:[{date:"2026-10-17",available:true}]}),"AVAILABLE");
});
test("Drafts normalize whitespace/order and detect actual edits",()=>{
  const saved=full();
  assert.equal(refereeSettingsChanged(saved,{...saved,level:" Level 2 "}),false);
  assert.equal(refereeSettingsChanged(saved,{...saved,acceptingAssignments:false}),true);
  assert.equal(refereeSettingsChanged(saved,{...saved,experienceYears:4}),true);
  assert.equal(normalizeRefereeSettings({...saved,biography:"  Bio  "}).biography,"Bio");
  const slots=[{day:2,start:"09:00",end:"17:00"},{day:6,start:"09:00",end:"17:00"}];
  assert.equal(refereeSettingsChanged({...saved,weeklyAvailability:slots},
    {...saved,weeklyAvailability:[...slots].reverse()}),false);
});
test("Invalid ranges, duplicate days, impossible dates and duplicate exceptions are rejected",()=>{
  assert.equal(refereeSettingsIssue(full()),null);
  assert.equal(refereeSettingsIssue({...full(),experienceYears:71}),"years");
  assert.equal(refereeSettingsIssue({...full(),weeklyAvailability:[
    {day:6,start:"17:00",end:"09:00"}]}),"weeklyRange");
  assert.equal(refereeSettingsIssue({...full(),weeklyAvailability:[
    {day:6,start:"09:00",end:"17:00"},{day:6,start:"10:00",end:"18:00"}]}),"duplicateDay");
  assert.equal(refereeSettingsIssue({...full(),exceptions:[{date:"2026-02-30",available:false}]}),"date");
  assert.equal(refereeSettingsIssue({...full(),exceptions:[
    {date:"2026-10-17",available:false},{date:"2026-10-17",available:true}]}),"duplicateDate");
});
const persian=new Intl.DateTimeFormat("fa-AF",{calendar:"persian"}).resolvedOptions().calendar==="persian";
test("Localized date grids have canonical dates and respect Nowruz", {skip:!persian},()=>{
  const gregory=refereeExceptionMonth("2026-03-21","en");
  const solar=refereeExceptionMonth("2026-03-21","fa-AF");
  assert.equal(gregory.monthKey,"2026-03");
  assert.equal(solar.monthKey,"1405-01");
  assert.equal(solar.cells.find(d=>d.inMonth)?.date,"2026-03-21");
  assert.equal(refereeExceptionMonth("2026-03-20","fa-AF").monthKey,"1404-12");
  assert.equal(refereeExceptionMonth("2026-03-21","ps-AF").monthKey,"1405-01");
  assert.equal(gregory.cells.length,42);
  assert.equal(solar.cells.length,42);
});
