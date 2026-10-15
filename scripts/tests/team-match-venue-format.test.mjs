import assert from "node:assert/strict";
import {test} from "node:test";
import {teamMatchSelectFacets,teamMatchSelectRows} from "../../apps/mobile/src/lib/team-detail-match-facets.ts";
import {emptyVenueMatchFilters,venueMatchResultEmphasis} from
  "../../apps/mobile/src/lib/venue-match-filters.ts";
const A="team-A",B="team-B",C="team-C";
const m=(id,homeTeamId,awayTeamId,competitionId,startsAt,status,homeScore=null,awayScore=null)=>({
  id,homeTeamId,awayTeamId,competitionId,competitionName:competitionId==="cup-1"?"City Cup":"League",
  homeTeamName:homeTeamId,awayTeamName:awayTeamId,
  startsAt,status,homeScore,awayScore,stage:"LEAGUE",
});
const matches=[
  m("up-1",A,B,"cup-1","2026-10-15T20:10:00Z","SCHEDULED"),
  m("up-2",C,A,"cup-2","2026-11-20T12:00:00Z","IN_PROGRESS"),
  m("post",A,C,"cup-1",null,"POSTPONED"),
  m("done",A,B,"cup-1","2026-10-14T14:00:00Z","COMPLETED",3,1),
  m("draw",C,A,"cup-2","2026-10-13T14:00:00Z","CORRECTED",2,2),
  m("unrelated","x","y","cup-1","2026-10-15T20:10:00Z","SCHEDULED"),
];
const zone="Asia/Kabul";
test("five filter options are scoped to the requested team and selected match phase",()=>{
  const upcoming=teamMatchSelectFacets(matches,A,"upcoming",zone);
  assert.deepEqual(upcoming.teams.map(x=>x.id),[B,C]);
  assert.equal(upcoming.competitions.length,2);
  assert.deepEqual(upcoming.months,[10,11]);
  assert.deepEqual(upcoming.years,[2026]);
  assert.equal(upcoming.weeks.length>0,true);
  assert.deepEqual(teamMatchSelectFacets(matches,A,"results",zone).months,[10]);
});
test("venue-style AND selectors filter the team fixture list and preserve sorting",()=>{
  assert.deepEqual(teamMatchSelectRows(matches,A,"upcoming",emptyVenueMatchFilters,zone)
    .map(x=>x.id),["up-2","up-1","post"]);
  assert.deepEqual(teamMatchSelectRows(matches,A,"upcoming",{
    ...emptyVenueMatchFilters,competitionId:"cup-1",teamId:B,year:"2026",month:"10",
  },zone).map(x=>x.id),["up-1"]);
  assert.deepEqual(teamMatchSelectRows(matches,A,"upcoming",{
    ...emptyVenueMatchFilters,week:"42",
  },zone).map(x=>x.id),["up-1"]);
  assert.deepEqual(teamMatchSelectRows(matches,A,"upcoming",{
    ...emptyVenueMatchFilters,teamId:C,
  },zone,"postponed").map(x=>x.id),["post"]);
  assert.deepEqual(teamMatchSelectRows(matches,A,"results",{
    ...emptyVenueMatchFilters,teamId:B,
  },zone,"win").map(x=>x.id),["done"]);
  assert.deepEqual(teamMatchSelectRows(matches,A,"results",{
    ...emptyVenueMatchFilters,teamId:C,
  },zone,"draw").map(x=>x.id),["draw"]);
});
test("shared result emphasis bolds only actual winner; draws or unrecorded scores are neutral",()=>{
  assert.deepEqual(venueMatchResultEmphasis("COMPLETED",3,1),{home:"winner",away:"loser"});
  assert.deepEqual(venueMatchResultEmphasis("CORRECTED",1,4),{home:"loser",away:"winner"});
  assert.deepEqual(venueMatchResultEmphasis("CORRECTED",2,2),{home:"neutral",away:"neutral"});
  assert.deepEqual(venueMatchResultEmphasis("COMPLETED",null,null),{home:"neutral",away:"neutral"});
});
