import assert from "node:assert/strict";
import {test} from "node:test";
import {verifiedTeamForm,rankedPublicPlayers,teamPerformanceDistribution,isStatsConsistent}
  from "../../apps/mobile/src/lib/team-detail-stats.ts";
const match=(id,homeTeamId,awayTeamId,status,homeScore,awayScore,startsAt)=>({
  id,competitionId:"cup",competitionName:"Cup",homeTeamName:"Home",awayTeamName:"Away",
  stage:"GROUP",homeTeamId,awayTeamId,status,homeScore,awayScore,startsAt,
});
const matches=[
  match("older","me","them","COMPLETED",2,1,"2026-10-01T00:00:00Z"),
  match("draw","them","me","CORRECTED",1,1,"2026-10-10T00:00:00Z"),
  match("loss","them","me","COMPLETED",3,1,"2026-10-09T00:00:00Z"),
  match("noScore","me","them","COMPLETED",null,1,"2026-10-15T00:00:00Z"),
  match("unrelated","x","y","COMPLETED",4,0,"2026-10-20T00:00:00Z"),
  match("scheduled","me","them","SCHEDULED",0,0,"2026-10-22T00:00:00Z"),
];
test("last five verified results are newest first, exclude unrelated and missing scores",()=>{
  const original=[...matches];
  const form=verifiedTeamForm(matches,"me");
  assert.deepEqual(form.map(x=>x.match.id),["draw","loss","older"]);
  assert.deepEqual(form.map(x=>x.outcome),["draw","loss","win"]);
  assert.deepEqual(form.map(x=>[x.scored,x.conceded]),[[1,1],[1,3],[2,1]]);
  assert.deepEqual(matches,original);
  assert.equal(verifiedTeamForm(matches,"me",2).length,2);
  assert.deepEqual(verifiedTeamForm([],"me"),[]);
});
test("ranked public players can switch goals, assists or appearances without mutating",()=>{
  const players=[
    {userId:"a",displayName:"A",goals:3,assists:2,appearances:6},
    {userId:"b",displayName:"B",goals:1,assists:8,appearances:4},
    {userId:"c",displayName:"C",goals:3,assists:1,appearances:9},
  ];
  assert.deepEqual(rankedPublicPlayers(players,"goals").map(x=>x.userId),["a","c","b"]);
  assert.deepEqual(rankedPublicPlayers(players,"assists").map(x=>x.userId),["b","a","c"]);
  assert.deepEqual(rankedPublicPlayers(players,"appearances").map(x=>x.userId),["c","a","b"]);
  assert.equal(players[0].userId,"a");
});
test("invalid negative player stats are excluded, never fabricated",()=>{
  assert.deepEqual(rankedPublicPlayers([{userId:"u",displayName:"U",goals:-2,assists:0,appearances:1}],"goals"),[]);
});
test("performance percentages use verified counts and are zero-safe",()=>{
  const s={played:5,wins:2,draws:1,losses:2,goalsFor:8,goalsAgainst:7,goalDifference:1,winRate:40,players:[]};
  const p=teamPerformanceDistribution(s);
  assert.deepEqual([p.wins.percent,p.draws.percent,p.losses.percent],[40,20,40]);
  assert.equal(isStatsConsistent(s),true);
  assert.equal(isStatsConsistent({...s,played:0}),false);
  assert.equal(teamPerformanceDistribution({...s,played:0}).wins.percent,0);
  assert.equal(isStatsConsistent({...s,goalDifference:999}),false);
});
