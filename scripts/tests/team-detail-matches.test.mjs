import assert from "node:assert/strict";
import {test} from "node:test";
import {
  filterTeamMatches,isTeamMatchFinished,isTeamMatchUpcoming,teamMatchHasVerifiedScore,
  teamMatchOutcome,teamMatchScoreLabel,teamMatchSnapshot,teamMatchCompetitionChoices,
  teamMatchUpcomingStatuses,teamMatchResultOutcomes,
} from "../../apps/mobile/src/lib/team-detail-matches.ts";

const match=(id,patch={})=>({
  id,competitionId:"cup",competitionName:"Autumn Cup",homeTeamId:"ours",
  awayTeamId:"rivals",homeTeamName:"",awayTeamName:"Rivals",status:"SCHEDULED",
  stage:"GROUP",startsAt:"2026-11-01T09:00:00Z",homeScore:null,awayScore:null,
  ...patch,
});
test("upcoming excludes completed, corrected and cancelled; results use status not the clock",()=>{
  const m=[match("live",{status:"IN_PROGRESS"}),
    match("post",{status:"POSTPONED"}),match("old",{status:"SCHEDULED",startsAt:"2020-01-01T00:00:00Z"}),
    match("final",{status:"COMPLETED",homeScore:3,awayScore:2}),
    match("fix",{status:"CORRECTED",homeScore:1,awayScore:2}),
    match("cancel",{status:"CANCELLED"})];
  assert.deepEqual(filterTeamMatches(m,"ours",{view:"upcoming"}).map(m=>m.id),["live","old","post"]);
  assert.deepEqual(filterTeamMatches(m,"ours",{view:"results"}).map(m=>m.id).sort(),["final","fix"]);
  assert.equal(isTeamMatchFinished(m[3]),true);
  assert.equal(isTeamMatchUpcoming(m[3]),false);
  assert.equal(isTeamMatchUpcoming(m[0]),true);
  assert.deepEqual(teamMatchSnapshot(m,"ours"),{upcoming:3,results:2});
});
test("only completed or corrected score pairs can be claimed verified",()=>{
  const verified=match("win",{status:"COMPLETED",homeScore:3,awayScore:1});
  assert.equal(teamMatchHasVerifiedScore(verified),true);
  assert.equal(teamMatchScoreLabel(verified),"3 : 1");
  assert.equal(teamMatchOutcome(verified,"ours"),"WIN");
  assert.equal(teamMatchOutcome(verified,"rivals"),"LOSS");
  assert.equal(teamMatchOutcome(verified,"stranger"),null);
  assert.equal(teamMatchOutcome(match("draw",{status:"CORRECTED",homeScore:2,awayScore:2}),"ours"),"DRAW");
  for(const invalid of [
    match("live",{status:"IN_PROGRESS",homeScore:1,awayScore:2}),
    match("missing",{status:"COMPLETED",homeScore:3,awayScore:null}),
    match("negative",{status:"COMPLETED",homeScore:-1,awayScore:2}),
    match("fraction",{status:"CORRECTED",homeScore:1.5,awayScore:2}),
  ]){
    assert.equal(teamMatchHasVerifiedScore(invalid),false);
    assert.equal(teamMatchOutcome(invalid,"ours"),null);
    assert.equal(teamMatchScoreLabel(invalid),null);
  }
});
test("upcoming is live first then dated scheduled then postponed; unknown date stays last",()=>{
  const m=[match("pending",{startsAt:null}),match("later",{startsAt:"2026-12-01T00:00:00Z"}),
    match("post",{status:"POSTPONED",startsAt:"2026-10-01T00:00:00Z"}),
    match("soon",{startsAt:"2026-11-01T00:00:00Z"}),
    match("live",{status:"IN_PROGRESS",startsAt:null})];
  assert.deepEqual(filterTeamMatches(m,"ours",{view:"upcoming"}).map(m=>m.id),
    ["live","soon","later","pending","post"]);
  assert.deepEqual(m.map(m=>m.id),["pending","later","post","soon","live"]);
});
test("results newest first, with missing date last and deterministic order",()=>{
  const m=[match("old",{status:"COMPLETED",startsAt:"2026-09-01T00:00:00Z"}),
    match("late",{status:"CORRECTED",startsAt:"2026-10-01T00:00:00Z"}),
    match("unknown",{status:"COMPLETED",startsAt:null})];
  assert.deepEqual(filterTeamMatches(m,"ours",{view:"results"}).map(m=>m.id),
    ["late","old","unknown"]);
});
test("combine public competition, opponent/stage search and result filter",()=>{
  const games=[match("one",{status:"COMPLETED",homeScore:2,awayScore:0,stage:"FINAL"}),
    match("two",{status:"COMPLETED",homeScore:1,awayScore:1,competitionId:"winter",
      competitionName:"Winter Cup",stage:"GROUP",awayTeamName:"Champions"}),
    match("other",{competitionId:"winter",competitionName:"Winter Cup",awayTeamName:"Falcons"}),
    match("not-ours",{homeTeamId:"another",awayTeamId:"else"})];
  assert.deepEqual(filterTeamMatches(games,"ours",{view:"results",outcome:"WIN"}).map(m=>m.id),["one"]);
  assert.deepEqual(filterTeamMatches(games,"ours",{view:"results",outcome:"DRAW",query:"CHAMP"}).map(m=>m.id),["two"]);
  assert.deepEqual(filterTeamMatches(games,"ours",{view:"results",competitionId:"cup",query:"final"}).map(m=>m.id),["one"]);
  assert.deepEqual(filterTeamMatches(games,"ours",{view:"upcoming",competitionId:"winter"}).map(m=>m.id),["other"]);
  assert.deepEqual(teamMatchCompetitionChoices(games,"ours"),[
    {id:"cup",name:"Autumn Cup"},{id:"winter",name:"Winter Cup"},
  ]);
  assert.deepEqual(teamMatchSnapshot(games,"ours"),{upcoming:1,results:2});
});
test("filters isolate states without fabricating results",()=>{
  const games=[match("live",{status:"IN_PROGRESS"}),match("scheduled",{status:"SCHEDULED"}),
    match("empty-score",{status:"CORRECTED",homeScore:null,awayScore:null})];
  assert.deepEqual(filterTeamMatches(games,"ours",{view:"upcoming",status:"IN_PROGRESS"}).map(m=>m.id),["live"]);
  assert.equal(filterTeamMatches(games,"ours",{view:"results",outcome:"WIN"}).length,0);
  assert.equal(filterTeamMatches(games,"ours",{view:"results",outcome:"DRAW"}).length,0);
  assert.equal(filterTeamMatches([],"ours",{view:"results"}).length,0);
  assert.ok(teamMatchUpcomingStatuses.includes("POSTPONED"));
  assert.ok(teamMatchResultOutcomes.includes("DRAW"));
});
