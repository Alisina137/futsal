import assert from "node:assert/strict";
import {test} from "node:test";
import {teamSquadView,canDisplayTeamRoster,mayOpenPublicPlayer,squadPositionFilters} from
  "../../apps/mobile/src/lib/team-detail-squad.ts";
const member=(userId,publicDisplayName,position="ALA",shirtNumber=null,role="PLAYER")=>({
  userId,publicDisplayName,position,shirtNumber,role,imageUrl:null,joinedAt:"2026-10-01T00:00:00Z",
});
const visible=[
  member("manager","Team Manager","UNSPECIFIED",null,"MANAGER"),
  member("captain","Captain","FIXO",9,"CAPTAIN"),
  member("three","Zaman","GOALKEEPER",4),
  member("four","Alisa","ALA",12),
  member("five","Ahmad","ALA",2),
];
test("roster sorts manager/captain first, then jerseys, never changes the input",()=>{
  const copy=[...visible];
  const selected=teamSquadView(visible,"manager","captain");
  assert.deepEqual(selected.members.map(x=>x.userId),
    ["manager","captain","five","three","four"]);
  assert.deepEqual(visible,copy);
});
test("role from authoritative captain ID is recognized even when stored role is stale",()=>{
  const members=[member("captain","Captain","PIVO",5),member("manager","Manager"),member("x","X")];
  const leaders=teamSquadView(members,"manager","captain",{leadersOnly:true});
  assert.deepEqual(leaders.members.map(x=>x.userId),["manager","captain"]);
  assert.equal(leaders.leadersCount,2);
});
test("position filter + Unicode name or jersey search work together",()=>{
  assert.deepEqual(teamSquadView(visible,"manager","captain",{position:"ALA"}).members.map(x=>x.userId),
    ["five","four"]);
  assert.deepEqual(teamSquadView(visible,"manager","captain",{position:"ALA",query:"ahm"}).members.map(x=>x.userId),
    ["five"]);
  assert.deepEqual(teamSquadView(visible,"manager","captain",{query:"12"}).members.map(x=>x.userId),
    ["four"]);
  assert.deepEqual(teamSquadView([member("fa","علی‌رضا")],"missing",null,{query:"علی"}).members.map(x=>x.userId),
    ["fa"]);
});
test("empty filters never fabricate players; selected captain can't bypass roster filtering",()=>{
  assert.equal(teamSquadView([],"manager","captain",{leadersOnly:true}).leadersCount,0);
  assert.equal(teamSquadView(visible,"manager","hiddenCaptain",{leadersOnly:true}).members.length,1);
  assert.equal(teamSquadView(visible,"manager","captain",{query:"unknown"}).members.length,0);
  assert.ok(squadPositionFilters.includes("UNSPECIFIED"));
});
test("private team roster requires approved member or manager",()=>{
  assert.equal(canDisplayTeamRoster("PRIVATE",false,false),false);
  assert.equal(canDisplayTeamRoster("PRIVATE",true,false),true);
  assert.equal(canDisplayTeamRoster("PRIVATE",false,true),true);
  assert.equal(canDisplayTeamRoster("PUBLIC",false,false),true);
});
test("private player cannot be deep-linked from a member-only roster",()=>{
  assert.equal(mayOpenPublicPlayer("visible",["visible"]),true);
  assert.equal(mayOpenPublicPlayer("private",["visible"]),false);
  assert.equal(mayOpenPublicPlayer("private",[]),false);
});
