import assert from "node:assert/strict";
import {test} from "node:test";
import {emptyCompetitionMatchPreferences,matchFitsDatePreset,
  matchFitsPreferences,normalizedCompetitionMatchPreferences}
  from "../../apps/mobile/src/lib/competition-detail-match-filters.ts";
const at="2026-10-15T20:15:00Z"; // Kabul: Oct 16 00:45
const now=new Date(at);
const row=(id,startsAt,more={})=>({
  id,competitionId:"competition-one",homeTeamId:"A",awayTeamId:"B",
  stage:"LEAGUE",roundNumber:1,groupName:null,startsAt,
  status:"SCHEDULED",...more,
});
const competition={
  teams:[{teamId:"A",status:"ACCEPTED"},{teamId:"B",status:"ACCEPTED"},{teamId:"C",status:"APPLIED"}],
  matches:[row("one","2026-10-16T00:00:00Z"),
    row("two","2026-10-17T09:00:00Z",{roundNumber:2,stage:"GROUP",groupName:"A"})],
};

test("Kabul today and tomorrow use local calendar boundary, not UTC date",()=>{
  assert.equal(matchFitsDatePreset("2026-10-15T20:00:00Z","TODAY",now),true);
  assert.equal(matchFitsDatePreset("2026-10-15T19:29:59Z","TODAY",now),false);
  assert.equal(matchFitsDatePreset("2026-10-16T19:30:00Z","TOMORROW",now),true);
  assert.equal(matchFitsDatePreset("2026-10-16T19:29:59Z","TOMORROW",now),false);
});

test("Next 7 days covers today through sixth day and never pulls past/8th",()=>{
  assert.equal(matchFitsDatePreset("2026-10-16T10:00:00Z","NEXT_7_DAYS",now),true);
  assert.equal(matchFitsDatePreset("2026-10-22T10:00:00Z","NEXT_7_DAYS",now),true);
  assert.equal(matchFitsDatePreset("2026-10-23T10:00:00Z","NEXT_7_DAYS",now),false);
  assert.equal(matchFitsDatePreset("2026-10-14T10:00:00Z","NEXT_7_DAYS",now),false);
});

test("unscheduled/invalid timestamps do not appear in dated views but remain in All",()=>{
  for(const input of [null,"nonsense","2026-14-15"]){
    assert.equal(matchFitsDatePreset(input,"ALL",now),true);
    assert.equal(matchFitsDatePreset(input,"TODAY",now),false);
    assert.equal(matchFitsDatePreset(input,"NEXT_7_DAYS",now),false);
  }
});

test("combined filters require correct participating team, group, stage, round and date",()=>{
  const prefs={teamId:"A",stage:"GROUP",round:2,group:"A",date:"TOMORROW"};
  assert.equal(matchFitsPreferences(competition.matches[1],prefs,now),true);
  assert.equal(matchFitsPreferences(competition.matches[0],prefs,now),false);
  assert.equal(matchFitsPreferences(competition.matches[1],{...prefs,teamId:"C"},now),false);
  assert.equal(matchFitsPreferences(competition.matches[1],{...prefs,round:1},now),false);
  assert.equal(matchFitsPreferences(competition.matches[1],{...prefs,date:"TODAY"},now),false);
});

test("competition switch ignores stale/unaccepted team and invalid stage/group/round",()=>{
  const previous={teamId:"C",stage:"KNOCKOUT",round:8,group:"Old",date:"TODAY"};
  assert.deepEqual(normalizedCompetitionMatchPreferences(previous,competition),{
    teamId:"ALL",stage:"ALL",round:null,group:"ALL",date:"TODAY",
  });
  const good={teamId:"B",stage:"GROUP",round:2,group:"A",date:"ALL"};
  assert.deepEqual(normalizedCompetitionMatchPreferences(good,competition),good);
});

test("clear resets all filters, including calendar choices",()=>{
  assert.deepEqual(emptyCompetitionMatchPreferences,{
    teamId:"ALL",stage:"ALL",round:null,group:"ALL",date:"ALL",
  });
  assert.equal(matchFitsPreferences(competition.matches[0],emptyCompetitionMatchPreferences,now),true);
});

test("empty competition, unfamiliar group and no scheduled dates remain safe",()=>{
  const options=normalizedCompetitionMatchPreferences({
    teamId:"A",stage:"LEAGUE",round:1,group:"A",date:"ALL",
  },{matches:[],teams:[]});
  assert.equal(options.teamId,"ALL");
  assert.equal(options.stage,"ALL");
  assert.equal(options.round,null);
  assert.equal(options.group,"ALL");
});
