import assert from "node:assert/strict";
import {test} from "node:test";
import {
 emptyVenueMatchFilters,venueMatchFitsFilters,venueMatchLocalParts,venueMatchResultEmphasis,
} from "../../apps/mobile/src/lib/venue-match-filters.ts";

const home="11111111-1111-4111-8111-111111111111";
const away="22222222-2222-4222-8222-222222222222";
const match={competitionId:"33333333-3333-4333-8333-333333333333",
  homeTeamId:home,awayTeamId:away,startsAt:"2026-10-15T20:10:00Z"};
test("all five filters combine by intersection, not partial UI-only filtering",()=>{
  const venue="Asia/Kabul";
  const expected=venueMatchLocalParts(match.startsAt,venue);
  assert.equal(expected.year,2026);
  assert.equal(expected.month,10);
  assert.equal(venueMatchFitsFilters(match,emptyVenueMatchFilters,venue),true);
  const filters={competitionId:match.competitionId,teamId:away,
    year:"2026",month:"10",week:String(expected.week)};
  assert.equal(venueMatchFitsFilters(match,filters,venue),true);
  for(const patch of [
    {competitionId:home},{teamId:"44444444-4444-4444-8444-444444444444"},
    {year:"2027"},{month:"11"},{week:String(expected.week===53?52:expected.week+1)},
  ])assert.equal(venueMatchFitsFilters(match,{...filters,...patch},venue),false,
    JSON.stringify(patch));
  assert.equal(venueMatchFitsFilters({...match,startsAt:null},
    {...emptyVenueMatchFilters,year:"2026"},venue),false);
});
test("venue-local midnight, ISO weeks and year rollover are stable",()=>{
  assert.deepEqual(venueMatchLocalParts("2026-10-15T20:10:00Z","Asia/Kabul"),
    {year:2026,month:10,week:42});
  assert.deepEqual(venueMatchLocalParts("2027-01-01T20:00:00Z","Asia/Kabul"),
    {year:2027,month:1,week:53});
  assert.deepEqual(venueMatchLocalParts("2028-02-28T20:00:00Z","Asia/Kabul"),
    {year:2028,month:2,week:9});
});
test("results winner bold, loser faded and draws neutral, including corrected score",()=>{
  assert.deepEqual(venueMatchResultEmphasis("COMPLETED",3,1),
    {home:"winner",away:"loser"});
  assert.deepEqual(venueMatchResultEmphasis("CORRECTED",0,2),
    {home:"loser",away:"winner"});
  for(const args of [
    ["COMPLETED",2,2],["COMPLETED",null,0],["IN_PROGRESS",3,0],
    ["SCHEDULED",1,0],
  ])assert.deepEqual(venueMatchResultEmphasis(...args),
    {home:"neutral",away:"neutral"});
});
