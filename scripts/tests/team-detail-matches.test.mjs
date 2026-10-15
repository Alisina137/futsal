import assert from "node:assert/strict";
import {test} from "node:test";
import {finished,teamMatchOutcome,teamMatchRows,teamMatchCompetitions} from
  "../../apps/mobile/src/lib/team-detail-matches.ts";
const row=(id,status,startsAt,homeScore=null,awayScore=null,homeTeamId="us",awayTeamId="them",competitionId="cup")=>({
  id,status,startsAt,homeScore,awayScore,homeTeamId,awayTeamId,competitionId,competitionName:competitionId,
  homeTeamName:"Home",awayTeamName:"Away",stage:"Group",
});
const matches=[
  row("future","SCHEDULED","2026-10-20T08:00:00Z"),
  row("live","IN_PROGRESS","2026-10-18T08:00:00Z"),
  row("postponed","POSTPONED",null),
  row("win","COMPLETED","2026-10-11T08:00:00Z",3,2),
  row("loss","CORRECTED","2026-10-12T08:00:00Z",4,1,"them","us","league"),
  row("draw","COMPLETED","2026-10-10T08:00:00Z",2,2),
  row("unverified","COMPLETED","2026-10-09T08:00:00Z",null,1),
  row("other","SCHEDULED","2026-10-17T08:00:00Z",null,null,"other","them"),
];
test("upcoming prioritizes live and sorts scheduled; null dates last",()=>{
  assert.deepEqual(teamMatchRows(matches,"us","upcoming").map(x=>x.id),["live","future","postponed"]);
  assert.deepEqual(teamMatchRows(matches,"us","upcoming","live").map(x=>x.id),["live"]);
  assert.deepEqual(teamMatchRows(matches,"us","upcoming","postponed").map(x=>x.id),["postponed"]);
});
test("results sort latest first; corrected counts as finished; scores are never fabricated",()=>{
  assert.equal(finished(matches[4]),true);
  assert.deepEqual(teamMatchRows(matches,"us","results").map(x=>x.id),["loss","win","draw","unverified"]);
  assert.equal(teamMatchOutcome(matches[6],"us"),null);
  assert.equal(teamMatchOutcome(matches[3],"us"),"win");
  assert.equal(teamMatchOutcome(matches[4],"us"),"loss");
  assert.equal(teamMatchOutcome(matches[5],"us"),"draw");
});
test("filters results accurately and ignores unrelated match records",()=>{
  assert.deepEqual(teamMatchRows(matches,"us","results","win").map(x=>x.id),["win"]);
  assert.deepEqual(teamMatchRows(matches,"us","results","loss","league").map(x=>x.id),["loss"]);
  assert.deepEqual(teamMatchRows(matches,"us","results","draw").map(x=>x.id),["draw"]);
  assert.deepEqual(teamMatchRows(matches,"us","upcoming","all","league"),[]);
});
test("competition filter lists only registered matching public fixtures",()=>{
  assert.deepEqual(teamMatchCompetitions(matches,"us","results").map(x=>x.id),["cup","league"]);
  assert.deepEqual(teamMatchCompetitions(matches,"us","upcoming").map(x=>x.id),["cup"]);
});
test("empty, malformed dates and stable ties never mutate source",()=>{
  const copy=[...matches];
  assert.deepEqual(teamMatchRows([], "us","results"),[]);
  assert.equal(teamMatchRows(matches,"missing","upcoming").length,0);
  const ties=[row("b","SCHEDULED",null),row("a","SCHEDULED",null)];
  assert.deepEqual(teamMatchRows(ties,"us","upcoming").map(x=>x.id),["a","b"]);
  assert.deepEqual(matches,copy);
});
