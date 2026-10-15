import assert from "node:assert/strict";
import {test} from "node:test";
import {teamCompetitionRows,teamCompetitionPhase,teamCompetitionAvailableFormats,
  teamCompetitionAvailableStatuses,teamCompetitionFixturePreview} from
  "../../apps/mobile/src/lib/team-detail-competitions.ts";

const c=(id,status,format="LEAGUE",startsAt=null,endsAt=null)=>({id,name:id,
  status,format,startsAt,endsAt});
const data=[
  c("future","SCHEDULED","LEAGUE","2026-11-04T10:00:00Z"),
  c("live","IN_PROGRESS","KNOCKOUT","2026-10-01T10:00:00Z"),
  c("open","REGISTRATION_OPEN","GROUP_KNOCKOUT","2026-12-01T10:00:00Z"),
  c("closed","REGISTRATION_CLOSED","LEAGUE",null),
  c("soon","SCHEDULED","LEAGUE","2026-10-29T10:00:00Z"),
  c("done","COMPLETED","LEAGUE","2026-05-10T10:00:00Z","2026-06-10T10:00:00Z"),
  c("old","ARCHIVED","KNOCKOUT","2026-02-01T10:00:00Z"),
  c("cancelled","CANCELLED","GROUP_KNOCKOUT","2026-08-01T10:00:00Z"),
  c("draft","DRAFT"),c("unrecognized","UNKNOWN"),
];
const m=(id,competitionId,status,startsAt,homeScore=null,awayScore=null,homeTeamId="our")=>({
  id,competitionId,competitionName:competitionId,status,stage:"Group",startsAt,
  homeScore,awayScore,homeTeamId,awayTeamId:"opponent",homeTeamName:"Home",awayTeamName:"Away",
});
test("public phase classification excludes draft/unknown and separates final states",()=>{
  assert.equal(teamCompetitionPhase("IN_PROGRESS"),"active");
  assert.equal(teamCompetitionPhase("CANCELLED"),"past");
  assert.equal(teamCompetitionPhase("COMPLETED"),"past");
  assert.equal(teamCompetitionPhase("DRAFT"),null);
  assert.equal(teamCompetitionPhase("UNKNOWN"),null);
});
test("active competitions prioritize live then closest scheduled start; no source mutation",()=>{
  const before=[...data];
  assert.deepEqual(teamCompetitionRows(data,"active").map(x=>x.id),
    ["live","soon","future","open","closed"]);
  assert.deepEqual(data,before);
});
test("past competitions use actual end/start dates, newest first and null last",()=>{
  assert.deepEqual(teamCompetitionRows(data,"past").map(x=>x.id),["cancelled","done","old"]);
  const extra=[c("unplanned","ARCHIVED")];
  assert.deepEqual(teamCompetitionRows([...extra,...data],"past").map(x=>x.id),
    ["cancelled","done","old","unplanned"]);
});
test("format and lifecycle filters compose, while filter chips derive from actual rows",()=>{
  assert.deepEqual(teamCompetitionRows(data,"active",{format:"LEAGUE",status:"SCHEDULED"})
    .map(x=>x.id),["soon","future"]);
  assert.deepEqual(teamCompetitionRows(data,"past",{format:"KNOCKOUT",status:"all"})
    .map(x=>x.id),["old"]);
  assert.deepEqual(teamCompetitionAvailableStatuses(data,"past"),["COMPLETED","ARCHIVED","CANCELLED"]);
  assert.deepEqual(teamCompetitionAvailableFormats(data,"active"),["LEAGUE","KNOCKOUT","GROUP_KNOCKOUT"]);
  assert.deepEqual(teamCompetitionRows([],"active"),[]);
});
test("fixture preview never leaks other competitions or teams and prioritizes live",()=>{
  const matches=[
    m("unrelated","elsewhere","IN_PROGRESS","2026-10-01T10:00:00Z"),
    m("otherTeam","live","IN_PROGRESS","2026-10-01T10:00:00Z",null,null,"another"),
    m("upcoming","live","SCHEDULED","2026-11-02T10:00:00Z"),
    m("playing","live","IN_PROGRESS","2026-10-31T10:00:00Z"),
    m("prior","live","COMPLETED","2026-10-25T10:00:00Z",2,1),
  ];
  assert.deepEqual(teamCompetitionFixturePreview(matches,"our","live"),
    {kind:"upcoming",match:matches[3]});
  assert.equal(teamCompetitionFixturePreview(matches,"our","missing"),null);
});
test("completed/corrected preview requires real recorded scores and chooses latest",()=>{
  const matches=[
    m("pending","old","COMPLETED","2026-12-12T10:00:00Z",null,1),
    m("recorded","old","CORRECTED","2026-10-15T10:00:00Z",2,0),
    m("earlier","old","COMPLETED","2026-10-10T10:00:00Z",1,1),
  ];
  assert.equal(teamCompetitionFixturePreview(matches,"our","old")?.match.id,"recorded");
  assert.equal(teamCompetitionFixturePreview([matches[0]],"our","old"),null);
});
