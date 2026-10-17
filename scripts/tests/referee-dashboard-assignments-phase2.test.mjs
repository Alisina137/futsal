import test from "node:test";
import assert from "node:assert/strict";
import {refereeAssignmentSection,refereeAssignmentHistoryStatus,
  refereeAssignmentTimeConflict,refereeVisibleAssignments}
  from "../../apps/mobile/src/lib/referee-assignments.ts";

const NOW=Date.parse("2026-10-17T08:00:00Z");
const time=minutes=>new Date(NOW+minutes*60_000).toISOString();
const match=(id,overrides={})=>({
  id,competitionId:"cup",competitionName:"Autumn Cup",
  venueId:"stadium",venueName:"Kabul Arena",venueAddress:"District 10",
  homeTeamId:"home",awayTeamId:"away",homeTeamName:"Eagles",awayTeamName:"Falcons",
  startsAt:time(60),endsAt:time(120),durationMinutes:60,
  responseStatus:"PENDING",matchStatus:"SCHEDULED",authorized:true,
  reportStatus:null,reportStartedAt:null,responseReason:null,...overrides,
});
test("pending and confirmed lists include actionable assignments only",()=>{
  const entries=[
    match("pending"),match("confirmed",{responseStatus:"ACCEPTED"}),
    match("completed",{responseStatus:"ACCEPTED",matchStatus:"COMPLETED"}),
    match("past",{startsAt:time(-180),endsAt:time(-120)}),
    match("revoked",{authorized:false}),
    match("withdrawn",{responseStatus:"WITHDRAW_REQUESTED"}),
  ];
  assert.deepEqual(refereeVisibleAssignments(entries,"pending","","ALL","ALL",NOW)
    .map(m=>m.id),["pending"]);
  assert.deepEqual(refereeVisibleAssignments(entries,"confirmed","","ALL","ALL",NOW)
    .map(m=>m.id),["confirmed"]);
  assert.deepEqual(refereeVisibleAssignments(entries,"history","","ALL","ALL",NOW)
    .map(m=>m.id),["completed","revoked","withdrawn","past"]);
});
test("historical decisions and finalized fixture statuses are distinct",()=>{
  for(const [patch,expected] of [
    [{responseStatus:"DECLINED"},"DECLINED"],
    [{responseStatus:"WITHDRAW_REQUESTED"},"WITHDRAW_REQUESTED"],
    [{matchStatus:"CANCELLED"},"CANCELLED"],
    [{matchStatus:"POSTPONED"},"POSTPONED"],
    [{matchStatus:"CORRECTED",responseStatus:"ACCEPTED"},"COMPLETED"],
    [{authorized:false},"REVOKED"],
    [{startsAt:time(-15)},"EXPIRED"],
  ]){
    assert.equal(refereeAssignmentHistoryStatus(match("a",patch),NOW),expected);
  }
});
test("search matches team, competition and venue and supports venue filter",()=>{
  const list=[
    match("one"),match("two",{competitionName:"Champions League",
      venueId:"b",venueName:"Bamyan Hall",homeTeamName:"Lions"}),
  ];
  assert.deepEqual(refereeVisibleAssignments(list,"pending"," lions ","ALL","ALL",NOW)
    .map(m=>m.id),["two"]);
  assert.deepEqual(refereeVisibleAssignments(list,"pending","CUP","ALL","ALL",NOW)
    .map(m=>m.id),["one"]);
  assert.deepEqual(refereeVisibleAssignments(list,"pending","","stadium","ALL",NOW)
    .map(m=>m.id),["one"]);
});
test("history status filter works for past invitations",()=>{
  const rows=[
    match("d",{responseStatus:"DECLINED"}),
    match("w",{responseStatus:"WITHDRAW_REQUESTED"}),
  ];
  assert.deepEqual(refereeVisibleAssignments(rows,"history","","ALL","DECLINED",NOW)
    .map(m=>m.id),["d"]);
  assert.deepEqual(refereeVisibleAssignments(rows,"history","","ALL","ALL",NOW)
    .map(m=>m.id),["d","w"]);
});
test("true overlapping accepted intervals block pending acceptance, adjacent matches do not",()=>{
  const candidate=match("new");
  const overlap=match("existing",{responseStatus:"ACCEPTED",
    startsAt:time(119),endsAt:time(150)});
  assert.equal(refereeAssignmentTimeConflict(candidate,[candidate,overlap])?.id,"existing");
  const adjacent=match("adjacent",{responseStatus:"ACCEPTED",
    startsAt:time(120),endsAt:time(180)});
  assert.equal(refereeAssignmentTimeConflict(candidate,[adjacent]),null);
  assert.equal(refereeAssignmentTimeConflict(candidate,[
    match("revoked",{responseStatus:"ACCEPTED",authorized:false})]),null);
});
test("history is newest first, pending is earliest first, source is not modified",()=>{
  const rows=Object.freeze([
    Object.freeze(match("later",{startsAt:time(120),endsAt:time(180)})),
    Object.freeze(match("early",{startsAt:time(30),endsAt:time(90)})),
  ]);
  assert.deepEqual(refereeVisibleAssignments(rows,"pending","","ALL","ALL",NOW)
    .map(m=>m.id),["early","later"]);
  assert.equal(rows[0].id,"later");
});
test("historical reassignment is read-only even when venue grant still exists",()=>{
  const old=match("old",{authorized:false,responseStatus:"ACCEPTED"});
  assert.equal(refereeAssignmentSection(old,NOW),"history");
  assert.equal(refereeAssignmentHistoryStatus(old,NOW),"REVOKED");
});
