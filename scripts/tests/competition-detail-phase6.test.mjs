import assert from "node:assert/strict";
import {test} from "node:test";
import {
  competitionTeamStatistics,competitionTeamFinishedMatches,
  competitionFairPlayStatistics,competitionPlayerLeaders,
} from "../../apps/mobile/src/lib/competition-detail-statistics.ts";

const team=(teamId,status="ACCEPTED")=>({
  teamId,teamName:teamId,offline:false,status,
});
const fixture=(id,homeTeamId,awayTeamId,homeScore,awayScore,status="COMPLETED",stage="LEAGUE")=>({
  id,homeTeamId,awayTeamId,homeScore,awayScore,status,stage,
});
const cup=(overrides={})=>({
  teams:[team("A"),team("B"),team("C")],matches:[],teamDisciplineStats:[],
  playerStats:[],...overrides,
});

test("counts complete and corrected league/group/knockout scores, full WDL and goal difference",()=>{
  const data=competitionTeamStatistics(cup({matches:[
    fixture("league","A","B",3,1),
    fixture("group","B","C",0,0,"COMPLETED","GROUP"),
    fixture("final","A","C",1,2,"CORRECTED","KNOCKOUT"),
  ]}));
  assert.equal(data.scoredMatches,3);
  const row=id=>data.teams.find(t=>t.teamId===id);
  assert.deepEqual({...row("A")},{teamId:"A",teamName:"A",offline:false,
    played:2,wins:1,draws:0,losses:1,goalsFor:4,goalsAgainst:3,goalDifference:1});
  assert.equal(row("B").played,2);
  assert.equal(row("B").wins,0);
  assert.equal(row("B").draws,1);
  assert.equal(row("B").losses,1);
  assert.equal(row("B").goalsAgainst,3);
  assert.equal(row("C").wins,1);
  assert.equal(row("C").draws,1);
  assert.equal(row("C").goalDifference,1);
});
test("shootout victory does not turn a drawn scoreline into a win",()=>{
  const data=competitionTeamStatistics(cup({matches:[
    {...fixture("ko","A","B",2,2,"COMPLETED","KNOCKOUT"),winnerTeamId:"A"},
  ]}));
  assert.equal(data.teams.find(t=>t.teamId==="A").draws,1);
  assert.equal(data.teams.find(t=>t.teamId==="A").wins,0);
  assert.equal(data.teams.find(t=>t.teamId==="B").losses,0);
});
test("live/draft/unscheduled/postponed/cancelled, no-score and incomplete games never inflate stats",()=>{
  const data=competitionTeamStatistics(cup({matches:[
    fixture("live","A","B",5,1,"IN_PROGRESS"),
    fixture("postponed","A","B",5,1,"POSTPONED"),
    fixture("cancelled","A","B",5,1,"CANCELLED"),
    fixture("no-score","A","B",null,null),
    fixture("partial","A","B",1,null),
    fixture("bye","A",null,1,0),
    fixture("same-team","A","A",1,0),
    fixture("negative","A","B",-1,0),
  ]}));
  assert.equal(data.scoredMatches,0);
  assert.ok(data.teams.every(row=>row.played===0&&row.goalsFor===0&&row.goalsAgainst===0));
});
test("removed or unaccepted team does not leak stats or award half a fixture",()=>{
  const data=competitionTeamStatistics(cup({
    teams:[team("A"),team("B","REJECTED"),team("C")],
    matches:[fixture("excluded","A","B",3,0),fixture("accepted","A","C",2,1)],
  }));
  assert.equal(data.scoredMatches,1);
  assert.equal(data.teams.length,2);
  assert.equal(data.teams.find(t=>t.teamId==="A").played,1);
  assert.ok(!data.teams.some(t=>t.teamId==="B"));
});
test("correction reflects current official score once, not historical versions",()=>{
  const data=competitionTeamStatistics(cup({matches:[
    fixture("corrected","A","B",0,2,"CORRECTED"),
  ]}));
  assert.equal(data.scoredMatches,1);
  assert.equal(data.teams.find(t=>t.teamId==="B").wins,1);
  assert.equal(data.teams.find(t=>t.teamId==="A").losses,1);
});
test("empty accepted roster returns a clean empty state",()=>{
  const data=competitionTeamStatistics(cup({teams:[team("A","WITHDRAWN")],
    matches:[fixture("old","A","B",1,0)]}));
  assert.equal(data.teams.length,0);
  assert.equal(data.scoredMatches,0);
});
test("disciplinary view distinguishes a legacy server lacking aggregates from zero incident reports",()=>{
  assert.equal(competitionFairPlayStatistics(cup({teamDisciplineStats:undefined})),null);
  const empty=competitionFairPlayStatistics(cup());
  assert.equal(empty.hasRecordedCards,false);
  assert.equal(empty.teams.length,3);
});
test("fair play counts are sourced from privacy-independent team aggregate and filter removed teams",()=>{
  const data=competitionFairPlayStatistics(cup({
    teams:[team("A"),team("B"),team("C","WITHDRAWN")],
    playerStats:[], // All contributing players could be private.
    teamDisciplineStats:[
      {teamId:"A",yellowCards:2,redCards:1},
      {teamId:"B",yellowCards:4,redCards:0},
      {teamId:"C",yellowCards:5,redCards:2},
    ],
  }));
  assert.equal(data.hasRecordedCards,true);
  assert.deepEqual(data.teams.map(x=>[x.teamId,x.yellowCards,x.redCards]),
    [["B",4,0],["A",2,1]]);
});
test("zero-card accepted teams remain visible alongside reported card totals",()=>{
  const data=competitionFairPlayStatistics(cup({
    teamDisciplineStats:[{teamId:"B",yellowCards:2,redCards:0}],
  }));
  assert.deepEqual(data.teams.map(x=>x.teamId),["A","C","B"]);
});
test("player leaders use verified accepted team IDs, metric sorting, team filter and nonzero events",()=>{
  const row=(playerUserId,teamId,goals,assists)=>({
    playerUserId,teamId,publicDisplayName:playerUserId,teamName:teamId,
    goals,assists,appearances:1,cleanSheets:0,yellowCards:0,redCards:0,
    playerOfMatchAwards:0,
  });
  const data=cup({
    teams:[team("A"),team("B","REJECTED")],
    playerStats:[row("p0","A",0,1),row("p1","A",1,4),row("removed","B",7,7)],
  });
  assert.deepEqual(competitionPlayerLeaders(data,"assists").map(x=>x.playerUserId),["p1","p0"]);
  assert.deepEqual(competitionPlayerLeaders(data,"goals").map(x=>x.playerUserId),["p1"]);
  assert.deepEqual(competitionPlayerLeaders(data,"assists","B"),[]);
});

test("More detail lists only this team's official completed/corrected scores, newest first",()=>{
  const data=cup({matches:[
    {...fixture("oct-01","A","B",3,1),startsAt:"2026-10-01T10:00:00Z",
      roundNumber:1,slotNumber:1},
    {...fixture("oct-05","C","A",2,2,"CORRECTED","GROUP"),
      startsAt:"2026-10-05T10:00:00Z",roundNumber:2,slotNumber:1},
    {...fixture("oct-04","B","C",1,0),startsAt:"2026-10-04T10:00:00Z",
      roundNumber:1,slotNumber:2},
    {...fixture("no-date","B","A",2,0),startsAt:null,roundNumber:3,slotNumber:1},
    {...fixture("live","A","B",9,0,"IN_PROGRESS"),startsAt:"2026-10-06T10:00:00Z"},
    {...fixture("unscored","A","B",null,1),startsAt:"2026-10-06T11:00:00Z"},
  ]});
  const matches=competitionTeamFinishedMatches(data,"A");
  assert.deepEqual(matches.map(m=>m.id),["oct-05","oct-01","no-date"]);
  assert.equal(matches.filter(m=>m.status==="CORRECTED").length,1);
  const ownScore=m=>m.homeTeamId==="A"?m.homeScore:m.awayScore;
  const opponentsScore=m=>m.homeTeamId==="A"?m.awayScore:m.homeScore;
  assert.deepEqual(matches.map(m=>[ownScore(m),opponentsScore(m)]),[[2,2],[3,1],[0,2]]);
  assert.equal(matches.length,competitionTeamStatistics(data).teams.find(team=>team.teamId==="A").played);
  assert.deepEqual(competitionTeamFinishedMatches(data,"removed"),[]);
});
test("Finished match details never reveal cancelled, unscored, invalid, removed or self fixtures",()=>{
  const fixtures=[
    fixture("valid","A","C",2,1),
    fixture("cancelled","A","C",2,1,"CANCELLED"),
    fixture("scheduled","A","C",2,1,"SCHEDULED"),
    fixture("postponed","A","C",2,1,"POSTPONED"),
    fixture("in-progress","A","C",2,1,"IN_PROGRESS"),
    fixture("incomplete","A","C",null,1),
    fixture("negative","A","C",-1,1),
    fixture("fractional","A","C",1.5,1),
    fixture("huge","A","C",Number.MAX_SAFE_INTEGER+1,1),
    fixture("same-team","A","A",2,1),
    fixture("bye","A",null,2,1),
    fixture("rejected","A","B",2,1),
  ];
  const data=cup({teams:[team("A"),team("B","REJECTED"),team("C")],matches:fixtures});
  assert.deepEqual(competitionTeamFinishedMatches(data,"A").map(match=>match.id),["valid"]);
  assert.deepEqual(competitionTeamFinishedMatches(data,"B"),[]);
  assert.equal(competitionTeamStatistics(data).scoredMatches,1);
  assert.equal(competitionTeamFinishedMatches(data,"A").length,
    competitionTeamStatistics(data).teams.find(row=>row.teamId==="A").played);
});
