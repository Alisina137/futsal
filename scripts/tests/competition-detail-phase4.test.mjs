import assert from "node:assert/strict";
import {test} from "node:test";
import {knockoutRoundColumns,verifiedKnockoutConnections,
  competitionStandingGroups,provisionalQualificationZone}
  from "../../apps/mobile/src/lib/competition-detail-standings.ts";

const match=(id,roundNumber,slotNumber,overrides={})=>({
  id,competitionId:"cup",stage:"KNOCKOUT",roundNumber,slotNumber,
  status:"SCHEDULED",homeTeamId:null,awayTeamId:null,
  homeScore:null,awayScore:null,winnerTeamId:null,nextMatchId:null,nextMatchSide:null,
  ...overrides,
});
const fixture=[
  match("s2",2,2,{status:"CORRECTED",homeTeamId:"C",awayTeamId:"D",
    homeScore:1,awayScore:2,winnerTeamId:"D",nextMatchId:"final",nextMatchSide:"AWAY"}),
  match("s1",2,1,{status:"COMPLETED",homeTeamId:"A",awayTeamId:"B",
    homeScore:3,awayScore:2,winnerTeamId:"A",nextMatchId:"final",nextMatchSide:"HOME"}),
  match("final",1,1,{status:"SCHEDULED",homeTeamId:"A",awayTeamId:"D"}),
  match("group",1,1,{stage:"GROUP",homeTeamId:"A",awayTeamId:"C"}),
];

test("knockout board renders official rounds in progression order, final last",()=>{
  const columns=knockoutRoundColumns(fixture);
  assert.deepEqual(columns.map(c=>c.round),[2,1]);
  assert.deepEqual(columns[0].matches.map(m=>m.id),["s1","s2"]);
  assert.equal(columns[0].isFinal,false);
  assert.equal(columns[1].isFinal,true);
  assert.equal(columns[1].matches[0].id,"final");
});
test("official completed/corrected winner displays a link only to their recorded next-match slot",()=>{
  assert.deepEqual(verifiedKnockoutConnections(fixture),[
    {sourceMatchId:"s2",nextMatchId:"final",nextRound:1,side:"AWAY",winnerTeamId:"D"},
    {sourceMatchId:"s1",nextMatchId:"final",nextRound:1,side:"HOME",winnerTeamId:"A"},
  ]);
});
test("no pending/live/postponed game publishes a winner as advanced",()=>{
  for(const status of ["SCHEDULED","IN_PROGRESS","UNSCHEDULED","POSTPONED","CANCELLED"]){
    const pending={...fixture[1],status};
    assert.deepEqual(verifiedKnockoutConnections([pending,fixture[2]]),[]);
  }
});
test("a winner ID, score and official next slot are all required",()=>{
  const source=fixture[1],destination=fixture[2];
  for(const patch of [
    {winnerTeamId:null},{winnerTeamId:"FOREIGN"},{homeScore:null},
    {awayScore:null},{nextMatchId:null},{nextMatchSide:null},
    {nextMatchId:"missing"},{nextMatchId:source.id},{nextMatchSide:"AWAY"},
  ]){
    assert.deepEqual(verifiedKnockoutConnections([{...source,...patch},destination]),[]);
  }
});
test("do not infer a winner into an empty or wrong next fixture slot",()=>{
  const original=fixture[1];
  assert.deepEqual(verifiedKnockoutConnections([original,
    {...fixture[2],homeTeamId:null}]),[]);
  assert.deepEqual(verifiedKnockoutConnections([original,
    {...fixture[2],homeTeamId:"Z"}]),[]);
  assert.deepEqual(verifiedKnockoutConnections([original,
    {...fixture[2],roundNumber:3}]),[]);
});
test("do not accept a connection to a separate stage or equal round",()=>{
  assert.deepEqual(verifiedKnockoutConnections([fixture[1],
    {...fixture[2],stage:"GROUP"}]),[]);
  assert.deepEqual(verifiedKnockoutConnections([fixture[1],
    {...fixture[2],roundNumber:2}]),[]);
});
test("group standings are grouped and ordered by official position, never recomputed locally",()=>{
  const row=(id,groupName,position)=>({teamId:id,teamName:id,groupName,position});
  const groups=competitionStandingGroups([
    row("B2","B",2),row("A2","A",2),row("B1","B",1),row("A1","A",1),
  ],"GROUP");
  assert.deepEqual(groups.map(x=>x.key),["A","B"]);
  assert.deepEqual(groups.map(x=>x.rows.map(r=>r.teamId)),[["A1","A2"],["B1","B2"]]);
});
test("league standings preserve a single team table and official ranks",()=>{
  const rows=[{teamId:"z",teamName:"Z",position:2,groupName:null},
    {teamId:"a",teamName:"A",position:1,groupName:null}];
  const result=competitionStandingGroups(rows,"LEAGUE");
  assert.equal(result.length,1);
  assert.equal(result[0].label,"");
  assert.deepEqual(result[0].rows.map(r=>r.teamId),["a","z"]);
});
test("qualification places are provisional only and reject missing or invalid counts",()=>{
  const group={key:"A",label:"A",rows:[{teamId:"a",position:1},
    {teamId:"b",position:2},{teamId:"c",position:3}]};
  assert.deepEqual(provisionalQualificationZone(group,2),["a","b"]);
  assert.deepEqual(provisionalQualificationZone(group,0),[]);
  assert.deepEqual(provisionalQualificationZone(group,null),[]);
  assert.deepEqual(provisionalQualificationZone(group,10),["a","b","c"]);
});
test("no bracket matches or standings present honest empty arrays",()=>{
  assert.deepEqual(knockoutRoundColumns([]),[]);
  assert.deepEqual(verifiedKnockoutConnections([]),[]);
  assert.deepEqual(competitionStandingGroups([],"GROUP"),[]);
});
