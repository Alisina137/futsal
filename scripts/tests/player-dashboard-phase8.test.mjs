import test from "node:test";
import assert from "node:assert/strict";
import {careerMonthShift,careerCalendarDate,careerPeriod,careerResults,
  careerMonthlyTrend,careerPersonalBest} from "../../apps/mobile/src/lib/player-career-view.ts";
import {normalizePlayerPreferences,playerPreferencesChanged,playerPreferencesValid}
  from "../../apps/mobile/src/lib/player-preferences.ts";

const solarAvailable=new Intl.DateTimeFormat("fa-AF",{calendar:"persian"})
  .resolvedOptions().calendar==="persian";
const month=day=>careerPeriod(day+"T12:00:00Z","fa-AF").key;
const record=(matchId,recordedAt,goals,assists,result="WIN")=>({
  matchId,recordedAt,goals,assists,result,
});

test("English calendar stays Gregorian and calendar heading has no artificial time",()=>{
  assert.equal(careerPeriod("2026-10-17T12:00:00Z","en").key,"2026-10");
  assert.match(careerCalendarDate("2026-10-17","en"),/2026/);
  assert.doesNotMatch(careerCalendarDate("2026-10-17","en"),/AM|PM/);
  assert.equal(careerCalendarDate("invalid","en"),"invalid");
});
test("Dari/Pashto month boundaries follow the Solar Hijri New Year",{
  skip:!solarAvailable,
},()=>{
  assert.equal(month("2026-03-20"),"1404-12");
  assert.equal(month("2026-03-21"),"1405-01");
  assert.equal(careerPeriod("2026-03-21T12:00:00Z","ps-AF").year,"1405");
  assert.equal(month(careerMonthShift("2026-03-20",1)),"1405-01");
  assert.equal(month(careerMonthShift("2026-03-21",-1)),"1404-12");
  assert.match(careerCalendarDate("2026-03-21","fa-AF"),/۱۴۰۵|1405/);
});
test("Solar cursor clamps day of month and navigates forward/back",{
  skip:!solarAvailable,
},()=>{
  for(const start of ["2026-01-30","2026-03-20","2026-03-21","2026-08-31","2026-10-17"]){
    const original=month(start);
    const next=careerMonthShift(start,1);
    const prev=careerMonthShift(start,-1);
    assert.notEqual(month(next),original);
    assert.notEqual(month(prev),original);
    assert.equal(month(careerMonthShift(next,-1)),original);
    assert.equal(month(careerMonthShift(prev,1)),original);
  }
  assert.equal(careerMonthShift("not-a-date",1),"not-a-date");
  assert.equal(careerMonthShift("2026-10-17",0),"2026-10-17");
  assert.equal(careerMonthShift("2026-10-17",25),"2026-10-17");
});
test("Kabul year rollover uses local time, not UTC date",()=>{
  assert.equal(careerPeriod("2025-12-31T20:20:00Z","en").key,"2026-01");
});
test("Lifetime career deduplicates official matches and respects result filters",()=>{
  const rows=[record("old","2025-11-01T12:00:00Z",2,1),
    record("new","2026-01-01T12:00:00Z",1,2,"LOSS"),
    record("old","2025-11-01T12:00:00Z",2,1)];
  assert.deepEqual(careerResults(rows,"ALL").map(x=>x.matchId),["new","old"]);
  assert.deepEqual(careerResults(rows,"LOSS").map(x=>x.matchId),["new"]);
  assert.deepEqual(careerPersonalBest(rows),{goals:2,assists:2});
  assert.equal(careerMonthlyTrend(rows,"matches","en")
    .reduce((sum,item)=>sum+item.value,0),2);
});
test("Private settings normalize, reject oversized fields and ignore whitespace edits",()=>{
  const base={defaultTeamId:null,biography:null,province:null,district:null,
    secondaryPosition:null,preferredFoot:null};
  const changed={...base,biography:"  trained daily  ",province:" Kabul "};
  const clean=normalizePlayerPreferences(changed);
  assert.equal(clean.biography,"trained daily");
  assert.equal(clean.province,"Kabul");
  assert.equal(playerPreferencesChanged(clean,changed),false);
  assert.equal(playerPreferencesChanged(clean,base),true);
  assert.equal(playerPreferencesValid({...base,biography:"x".repeat(501)}),false);
  assert.equal(playerPreferencesValid({...base,province:"x".repeat(81)}),false);
});
