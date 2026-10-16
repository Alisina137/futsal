import assert from "node:assert/strict";
import {analyticsSeasons,rankTeamPlayers,scopedTeamAnalytics}
  from "../apps/mobile/src/lib/team-manager-analytics.ts";
const home="11111111-1111-4111-8111-111111111111";
const away="22222222-2222-4222-8222-222222222222";
const fixture=(id,competitionId,startsAt,homeScore,awayScore,status="COMPLETED")=>({
  id,competitionId,startsAt,status,homeTeamId:home,awayTeamId:away,homeScore,awayScore,
});
const row=(matchId,competitionId,userId,goals,assists,extras={})=>({
  matchId,competitionId,startsAt:"2026-10-12T20:30:00Z",
  userId,displayName:userId,appeared:true,goals,assists,
  yellowCards:0,redCards:0,cleanSheet:false,playerOfMatch:false,...extras,
});
const details={matches:[
  fixture("w","compA","2026-10-12T20:30:00Z",3,1),
  fixture("d","compA","2026-10-04T10:00:00Z",1,1,"CORRECTED"),
  fixture("l","compB","2025-04-04T10:00:00Z",0,2),
  fixture("pending","compA","2026-10-15T10:00:00Z",8,0,"IN_PROGRESS"),
  fixture("undated","compA",null,2,0),
],players:[
  row("w","compA","alex",2,0,{playerOfMatch:true}),
  row("d","compA","alex",0,1),
  row("l","compB","ben",0,1,{yellowCards:1}),
  row("pending","compA","cheater",50,50),
  row("absent","compA","orphan",10,10),
]};
const all={competitionId:"ALL",season:"ALL",range:"ALL"};
const total=scopedTeamAnalytics(details,home,all,new Date("2026-10-16T12:00:00Z").getTime());
assert.deepEqual(total.stats,{played:4,wins:2,draws:1,losses:1,goalsFor:6,
  goalsAgainst:4,goalDifference:2,winRate:50});
assert.equal(total.players.find(p=>p.userId==="alex")?.goals,2);
assert.equal(total.players.some(p=>p.userId==="cheater"),false);
assert.equal(total.players.some(p=>p.userId==="orphan"),false);
assert.deepEqual(total.trend.map(m=>m.id),["w","d","l"],"Undated fixture does not invent a recent date");
assert.deepEqual(analyticsSeasons(details.matches),["2026","2025"]);
const competition=scopedTeamAnalytics(details,home,{...all,competitionId:"compA"});
assert.deepEqual(competition.stats,{played:3,wins:2,draws:1,losses:0,
  goalsFor:6,goalsAgainst:2,goalDifference:4,winRate:67});
assert.equal(competition.players.some(p=>p.userId==="ben"),false);
const season=scopedTeamAnalytics(details,home,{...all,season:"2025"});
assert.equal(season.stats.played,1);
assert.equal(season.stats.losses,1);
const now=new Date("2026-10-16T12:00:00Z").getTime();
const recent=scopedTeamAnalytics(details,home,{...all,range:"D30"},now);
assert.equal(recent.stats.played,2,"Undated, old and live games cannot enter date-scoped metrics");
const narrow=scopedTeamAnalytics(details,home,{...all,season:"2025",range:"D30"},now);
assert.equal(narrow.stats.played,0);
assert.deepEqual(narrow.players,[]);
const players=[{userId:"a",displayName:"Alex",matches:3,goals:2,assists:0,
  yellowCards:0,redCards:0,cleanSheets:0,playerOfMatch:0},
 {userId:"b",displayName:"Ben",matches:1,goals:0,assists:9,
  yellowCards:0,redCards:0,cleanSheets:0,playerOfMatch:0}];
assert.equal(rankTeamPlayers(players,"GOALS")[0].userId,"a");
assert.equal(rankTeamPlayers(players,"ASSISTS")[0].userId,"b");
assert.equal(rankTeamPlayers(players,"APPEARANCES")[0].userId,"a");
console.log("Team Manager Phase 7 analytics passed: verified-only, corrected results, team and competition/year/date scoping, Kabul years, dated form and metric rankings.");
