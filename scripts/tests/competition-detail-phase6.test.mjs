import test from "node:test";
import assert from "node:assert/strict";
import {competitionTeamStatistics,competitionRecordedDiscipline} from "../../apps/mobile/src/lib/competition-detail-statistics.ts";
const team=(teamId,status="ACCEPTED")=>({teamId,teamName:teamId,status,offline:false});
const match=(id,homeTeamId,awayTeamId,homeScore,awayScore,status="COMPLETED")=>
  ({id,homeTeamId,awayTeamId,homeScore,awayScore,status});
test("only finalized scored accepted-team fixtures contribute",()=>{
  const competition={teams:[team("a"),team("b"),team("c","PENDING")],
    matches:[match("1","a","b",2,1),match("2","b","a",0,0,"CORRECTED"),
      match("3","a","b",10,0,"LIVE"),match("4","a","c",7,0),
      match("5","a","b",null,null),match("6","a","a",4,1)]};
  const rows=competitionTeamStatistics(competition);
  assert.equal(rows.length,2);
  const a=rows.find(row=>row.teamId==="a");
  assert.deepEqual([a.played,a.wins,a.draws,a.losses,a.goals,a.conceded,a.goalDifference],
    [2,1,1,0,2,1,1]);
  const b=rows.find(row=>row.teamId==="b");
  assert.deepEqual([b.played,b.wins,b.draws,b.losses,b.goals,b.conceded,b.goalDifference],
    [2,0,1,1,1,2,-1]);
});
test("no results keeps played and all scores at zero",()=>{
  const rows=competitionTeamStatistics({teams:[team("a")],matches:[]});
  assert.equal(rows[0].played,0);
  assert.equal(rows[0].goalDifference,0);
});
test("recorded discipline ignores nonaccepted teams and includes zero-data note",()=>{
  const rows=competitionRecordedDiscipline({teams:[team("a"),team("b"),team("private","INVITED")],
    playerStats:[{teamId:"a",yellowCards:2,redCards:1},
      {teamId:"a",yellowCards:1,redCards:0},{teamId:"private",yellowCards:99,redCards:99}]});
  assert.equal(rows.length,2);
  assert.deepEqual([rows.find(r=>r.teamId==="a").yellow,rows.find(r=>r.teamId==="a").red],[3,1]);
  assert.equal(rows.find(r=>r.teamId==="b").recordedPlayers,0);
});
