import {test} from "node:test";
import assert from "node:assert/strict";
import {competitionHomeSnapshot,competitionShareMessage} from
  "../../apps/mobile/src/lib/competition-detail-home.ts";

const NOW=new Date("2026-10-15T10:00:00Z");
const match=(id,status,startsAt=null,homeScore=null,awayScore=null)=>({
  id,status,startsAt,homeScore,awayScore,competitionId:"cup",
  homeTeamId:"A",awayTeamId:"B",
});
const cup=(overrides={})=>({
  status:"REGISTRATION_OPEN",teams:[],matches:[],championTeamId:null,
  maxTeams:4,registrationClosesAt:"2026-10-18T10:00:00Z",...overrides,
});

test("open, eligible registration points to Teams → Registration without inventing a slot",()=>{
  const s=competitionHomeSnapshot(cup({teams:[{teamId:"A",status:"ACCEPTED"}]}),NOW);
  assert.equal(s.acceptedCount,1);
  assert.equal(s.remainingPlaces,3);
  assert.equal(s.registrationOpen,true);
  assert.deepEqual(s.action,{main:"TEAMS",sub:"REGISTRATION"});
  assert.equal(s.champion,null);
});

test("full or expired registration never advertises a registration action",()=>{
  const full=cup({teams:[...Array(4)].map((_,i)=>({teamId:String(i),status:"ACCEPTED"}))});
  assert.equal(competitionHomeSnapshot(full,NOW).registrationOpen,false);
  assert.deepEqual(competitionHomeSnapshot(full,NOW).action,{main:"MATCHES",sub:"ALL"});
  assert.equal(competitionHomeSnapshot(cup({registrationClosesAt:"2026-10-14T10:00:00Z"}),NOW).registrationOpen,false);
  assert.equal(competitionHomeSnapshot(cup({status:"REGISTRATION_CLOSED"}),NOW).registrationOpen,false);
});

test("live scores win CTA priority over upcoming fixtures and cannot be faked from scheduled records",()=>{
  const s=competitionHomeSnapshot(cup({status:"IN_PROGRESS",matches:[
    match("later","SCHEDULED","2026-10-20T10:00:00Z"),
    match("playing","IN_PROGRESS","2026-10-15T09:00:00Z"),
  ]}),NOW);
  assert.deepEqual(s.live.map(m=>m.id),["playing"]);
  assert.equal(s.upcoming?.id,"later");
  assert.deepEqual(s.action,{main:"MATCHES",sub:"LIVE"});
});

test("next fixture excludes past, postponed, unscheduled and cancelled matches",()=>{
  const matches=[
    match("past","SCHEDULED","2026-10-13T10:00:00Z"),
    match("unset","UNSCHEDULED"),
    match("postponed","POSTPONED","2026-10-16T10:00:00Z"),
    match("cancelled","CANCELLED","2026-10-16T11:00:00Z"),
    match("next","SCHEDULED","2026-10-17T10:00:00Z"),
    match("later","SCHEDULED","2026-10-21T10:00:00Z"),
  ];
  const s=competitionHomeSnapshot(cup({status:"SCHEDULED",matches}),NOW);
  assert.equal(s.upcoming?.id,"next");
  assert.deepEqual(s.action,{main:"MATCHES",sub:"UPCOMING"});
});

test("verified completed results count only official scored matches",()=>{
  const s=competitionHomeSnapshot(cup({status:"COMPLETED",
    teams:[{teamId:"A",status:"ACCEPTED"},{teamId:"B",status:"ACCEPTED"}],
    matches:[
    match("ok","COMPLETED",null,2,0),
    match("corrected","CORRECTED",null,0,1),
    match("notScored","COMPLETED"),
    match("live","IN_PROGRESS",null,1,0),
  ]}),NOW);
  assert.equal(s.verifiedResults,2);
  assert.deepEqual(s.action,{main:"MATCHES",sub:"RESULTS"});
});

test("only finished or archived accepted champion receives champion card",()=>{
  const A={teamId:"A",teamName:"A Champions",status:"ACCEPTED"};
  const B={teamId:"B",teamName:"B pending",status:"APPLIED"};
  assert.equal(competitionHomeSnapshot(cup({status:"IN_PROGRESS",
    teams:[A],championTeamId:"A"}),NOW).champion,null);
  assert.equal(competitionHomeSnapshot(cup({status:"COMPLETED",
    teams:[A,B],championTeamId:"B"}),NOW).champion,null);
  assert.equal(competitionHomeSnapshot(cup({status:"COMPLETED",
    teams:[A,B],championTeamId:"A"}),NOW).champion?.teamName,"A Champions");
});

test("share message includes actual competition name, venue and a navigable existing app link",()=>{
  assert.equal(competitionShareMessage(" Kabul Cup ","competition-id"," Shams Venue "),
    "Kabul Cup · Shams Venue\nleaguekick://competitions/competition-id");
  assert.equal(competitionShareMessage("Kabul Cup","competition-id"),
    "Kabul Cup\nleaguekick://competitions/competition-id");
});

test("empty datasets expose truthful zeroes and a working Matches destination",()=>{
  const s=competitionHomeSnapshot(cup({status:"ARCHIVED",maxTeams:0,
    registrationClosesAt:null,teams:[],matches:[]}),NOW);
  assert.equal(s.acceptedCount,0);
  assert.equal(s.verifiedResults,0);
  assert.equal(s.remainingPlaces,0);
  assert.equal(s.champion,null);
  assert.equal(s.upcoming,null);
  assert.deepEqual(s.action,{main:"MATCHES",sub:"ALL"});
});
