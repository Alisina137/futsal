import assert from "node:assert/strict";
import {test} from "node:test";
import {
  emptyCompetitionMatchPreferences,matchFitsPreferences,matchFitsDatePreset,
  normalizedCompetitionMatchPreferences,
} from "../../apps/mobile/src/lib/competition-detail-match-filters.ts";

const now=new Date("2026-10-15T21:00:00Z"); // 16 Oct in Kabul
const home="accepted-team-1",away="accepted-team-2";
const fixture=(id,startsAt,stage="LEAGUE",roundNumber=1,groupName=null)=>({
  id,startsAt,stage,roundNumber,groupName,
  homeTeamId:home,awayTeamId:away,
});
const today=fixture("today","2026-10-16T08:00:00Z");
const tomorrow=fixture("tomorrow","2026-10-17T08:00:00Z");
const nextWeek=fixture("beyond","2026-10-25T08:00:00Z","GROUP",2,"Group A");
test("date dropdown applies Kabul-local Today, Tomorrow and Next 7 Days correctly",()=>{
  assert.equal(matchFitsDatePreset(today.startsAt,"TODAY",now),true);
  assert.equal(matchFitsDatePreset(tomorrow.startsAt,"TODAY",now),false);
  assert.equal(matchFitsDatePreset(tomorrow.startsAt,"TOMORROW",now),true);
  assert.equal(matchFitsDatePreset(today.startsAt,"NEXT_7_DAYS",now),true);
  assert.equal(matchFitsDatePreset(tomorrow.startsAt,"NEXT_7_DAYS",now),true);
  assert.equal(matchFitsDatePreset(nextWeek.startsAt,"NEXT_7_DAYS",now),false);
  assert.equal(matchFitsDatePreset(null,"ALL",now),true);
  assert.equal(matchFitsDatePreset(null,"TODAY",now),false);
});
test("team, stage, round, group and date filters remain conjunctive after dropdown swap",()=>{
  const match=nextWeek;
  const selected={teamId:home,stage:"GROUP",round:2,group:"Group A",date:"ALL"};
  assert.equal(matchFitsPreferences(match,selected,now),true);
  assert.equal(matchFitsPreferences(match,{...selected,teamId:"unrelated"},now),false);
  assert.equal(matchFitsPreferences(match,{...selected,stage:"LEAGUE"},now),false);
  assert.equal(matchFitsPreferences(match,{...selected,round:1},now),false);
  assert.equal(matchFitsPreferences(match,{...selected,group:"Group B"},now),false);
  assert.equal(matchFitsPreferences(match,{...selected,date:"TODAY"},now),false);
  assert.equal(matchFitsPreferences(match,emptyCompetitionMatchPreferences,now),true);
});
test("saved dropdown preferences normalize to accepted teams and valid stages/rounds",()=>{
  const competition={
    teams:[{teamId:home,status:"ACCEPTED"},{teamId:"pending-team",status:"PENDING"}],
    matches:[today,nextWeek],
  };
  assert.deepEqual(normalizedCompetitionMatchPreferences({
    teamId:home,stage:"GROUP",round:2,group:"Group A",date:"ALL",
  },competition),{
    teamId:home,stage:"GROUP",round:2,group:"Group A",date:"ALL",
  });
  assert.deepEqual(normalizedCompetitionMatchPreferences({
    teamId:"pending-team",stage:"GROUP",round:1,group:"Group A",date:"TODAY",
  },competition),{
    teamId:"ALL",stage:"GROUP",round:null,group:"Group A",date:"TODAY",
  });
});
