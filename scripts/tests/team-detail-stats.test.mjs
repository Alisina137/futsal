import assert from "node:assert/strict";
import {test} from "node:test";
import {teamRecentForm,teamPlayerLeaders,safeTeamWinRate,teamResultBreakdown} from
  "../../apps/mobile/src/lib/team-detail-stats.ts";

const match=(id,status,startsAt,homeTeamId="our",awayTeamId="other",homeScore=1,awayScore=0)=>({
  id,status,startsAt,homeTeamId,awayTeamId,homeScore,awayScore,competitionId:"cup",
  competitionName:"Cup",stage:"Group",homeTeamName:"Home",awayTeamName:"Away",
});
test("verified recent form rejects unrelated and non-final games and handles away-team scores",()=>{
  const matches=[
    match("unrelated","COMPLETED","2026-12-01T10:00:00Z","a","b",5,0),
    match("live","IN_PROGRESS","2026-11-01T10:00:00Z"),
    match("unverified","COMPLETED","2026-10-31T10:00:00Z","our","other",null,4),
    match("away","CORRECTED","2026-10-20T10:00:00Z","other","our",3,1),
    match("home","COMPLETED","2026-10-10T10:00:00Z","our","other",1,0),
    match("draw","COMPLETED","2026-10-05T10:00:00Z","our","other",2,2),
  ];
  assert.deepEqual(teamRecentForm(matches,"our").map(x=>x.outcome),["loss","win","draw"]);
  assert.deepEqual(teamRecentForm(matches,"our")[0],{
    match:matches[3],outcome:"loss",ourGoals:1,theirGoals:3,opponentName:"Home",
  });
  assert.deepEqual(teamRecentForm(matches,"our",2).map(x=>x.match.id),["away","home"]);
});
test("recent form handles missing dates and deterministic tie sorting",()=>{
  const matches=[match("z","COMPLETED",null),match("b","COMPLETED","2026-10-01T00:00:00Z"),
    match("a","COMPLETED","2026-10-01T00:00:00Z")];
  const before=[...matches];
  assert.deepEqual(teamRecentForm(matches,"our").map(x=>x.match.id),["a","b","z"]);
  assert.deepEqual(matches,before);
  assert.deepEqual(teamRecentForm([],"our"),[]);
});
const player=(userId,goals,assists,appearances)=>({
  userId,displayName:userId,goals,assists,appearances,
});
test("leaders genuinely order goals, assists and appearances, without mutating inputs",()=>{
  const players=[player("goal",10,1,2),player("assist",2,15,3),
    player("played",0,0,20),player("minor",0,0,0)];
  const before=[...players];
  assert.equal(teamPlayerLeaders(players,"goals")[0]?.userId,"goal");
  assert.equal(teamPlayerLeaders(players,"assists")[0]?.userId,"assist");
  assert.equal(teamPlayerLeaders(players,"appearances")[0]?.userId,"played");
  assert.equal(teamPlayerLeaders(players,"goals",2).length,2);
  assert.deepEqual(players,before);
});
test("ties sort predictably and missing player data creates no fabricated leaders",()=>{
  assert.deepEqual(teamPlayerLeaders([player("b",1,0,1),player("a",1,0,1)],"goals")
    .map(x=>x.userId),["a","b"]);
  assert.deepEqual(teamPlayerLeaders([],"goals"),[]);
});
test("win-rate chart clamps malformed percentages; zero games displays no fake form",()=>{
  assert.equal(safeTeamWinRate(-5),0);
  assert.equal(safeTeamWinRate(200),100);
  assert.equal(safeTeamWinRate(NaN),0);
  assert.equal(safeTeamWinRate(61),61);
  assert.deepEqual(teamResultBreakdown({played:0,wins:0,draws:0,losses:0}),
    {win:0,draw:0,loss:0});
});
test("match breakdown is data-backed with correct percentage widths",()=>{
  assert.deepEqual(teamResultBreakdown({played:5,wins:3,draws:1,losses:1}),
    {win:60,draw:20,loss:20});
  assert.deepEqual(teamResultBreakdown({played:3,wins:1,draws:1,losses:1}),
    {win:100/3,draw:100/3,loss:100/3});
});
