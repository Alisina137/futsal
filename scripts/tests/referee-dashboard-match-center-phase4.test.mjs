import test from "node:test";
import assert from "node:assert/strict";
import {refereeWorkspaceInitialTab,refereeWorkspaceTabs,refereeTeamRoster,
  refereeWorkspaceAllowsFinish,refereeMatchEventTotals}
  from "../../apps/mobile/src/lib/referee-match-center.ts";

const clock={period:2,elapsedSeconds:125,runningSince:null};
const startedReport={status:"DRAFT",startedAt:"2026-10-17T07:00:00Z",
  finishedAt:null,clock};
test("Workspace has four distinct context-specific tabs",()=>{
  assert.deepEqual(refereeWorkspaceTabs,["scoreboard","events","teams","report"]);
  assert.equal(refereeWorkspaceInitialTab("upcoming"),"scoreboard");
  assert.equal(refereeWorkspaceInitialTab("live"),"scoreboard");
  assert.equal(refereeWorkspaceInitialTab("reports"),"report");
});
test("Finish is blocked before kickoff and before the second period",()=>{
  assert.equal(refereeWorkspaceAllowsFinish(null,0,true,false),false);
  assert.equal(refereeWorkspaceAllowsFinish({...startedReport,startedAt:null},0,true,false),false);
  assert.equal(refereeWorkspaceAllowsFinish({...startedReport,
    clock:{...clock,period:1}},0,true,false),false);
});
test("Finish is blocked if offline, syncing, unsynced, completed or being reviewed",()=>{
  assert.equal(refereeWorkspaceAllowsFinish(startedReport,1,true,false),false);
  assert.equal(refereeWorkspaceAllowsFinish(startedReport,0,false,false),false);
  assert.equal(refereeWorkspaceAllowsFinish(startedReport,0,true,true),false);
  assert.equal(refereeWorkspaceAllowsFinish({...startedReport,finishedAt:"2026-10-17T07:35:00Z"},
    0,true,false),false);
  assert.equal(refereeWorkspaceAllowsFinish({...startedReport,status:"SUBMITTED"},0,true,false),false);
});
test("Finish permitted only for active second-period draft with acknowledged events",()=>{
  assert.equal(refereeWorkspaceAllowsFinish(startedReport,0,true,false),true);
});
test("Home and away rosters remain isolated and sort numbered players first",()=>{
  const roster=[
    {teamId:"away",userId:"guest",name:"Guest",shirtNumber:4},
    {teamId:"home",userId:"second",name:"Second",shirtNumber:10},
    {teamId:"home",userId:"unlisted",name:"Unlisted",shirtNumber:null},
    {teamId:"home",userId:"first",name:"First",shirtNumber:2},
  ];
  assert.deepEqual(refereeTeamRoster(roster,"home").map(p=>p.userId),
    ["first","second","unlisted"]);
  assert.deepEqual(refereeTeamRoster(roster,"away").map(p=>p.userId),["guest"]);
  assert.deepEqual(refereeTeamRoster(roster,null),[]);
  assert.equal(roster[0].userId,"guest");
});
test("Event counts preserve official event IDs and do not double count adjacent types",()=>{
  const events=["GOAL","GOAL","FOUL","YELLOW_CARD","RED_CARD",
    "TIMEOUT","SUBSTITUTION","INCIDENT"].map((kind,index)=>({id:String(index),kind}));
  assert.deepEqual(refereeMatchEventTotals(events),{
    GOAL:2,YELLOW_CARD:1,RED_CARD:1,FOUL:1,TIMEOUT:1,SUBSTITUTION:1,INCIDENT:1,
  });
  assert.equal(events.length,8);
});
test("Unknown event kinds cannot mutate the finite official statistics object",()=>{
  const events=[{kind:"UNKNOWN"},{kind:"__proto__"},{kind:"GOAL"}];
  const counts=refereeMatchEventTotals(events);
  assert.equal(counts.GOAL,1);
  assert.equal(Object.keys(counts).length,7);
  assert.equal(Object.prototype.hasOwnProperty.call(counts,"UNKNOWN"),false);
});
