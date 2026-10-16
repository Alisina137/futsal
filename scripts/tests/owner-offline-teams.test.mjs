import assert from "node:assert/strict";
import {test} from "node:test";
import {
  duplicateOfflineTeam,normalizeOfflineText,searchOfflineTeams,registerableOwnerCompetitions,
} from "../../apps/mobile/src/lib/owner-manual-teams.ts";

const teams=[
  {id:"a",name:" Kabul Stars ",city:"Kabul"},
  {id:"b",name:"Afghan Eagles",city:"Herat"},
  {id:"c",name:"Kabul Juniors",city:"Kabul"},
];
test("names normalize case, space and Unicode presentation before checking duplicates",()=>{
  assert.equal(normalizeOfflineText("  KABUL   STARS "),"kabul stars");
  assert.equal(duplicateOfflineTeam(teams,"kabul stars"," KABUL ")?.id,"a");
  assert.equal(duplicateOfflineTeam(teams,"Kabul Stars","Kabul","a"),null);
  assert.equal(duplicateOfflineTeam(teams,"Kabul Stars","Herat"),null);
});
test("search scans both city and name while keeping city scope",()=>{
  assert.deepEqual(searchOfflineTeams(teams,"kabul","").map(x=>x.id),["c","a"]);
  assert.deepEqual(searchOfflineTeams(teams,"","Kabul").map(x=>x.id),["c","a"]);
  assert.deepEqual(searchOfflineTeams(teams,"eagles","Kabul"),[]);
  assert.deepEqual(searchOfflineTeams(teams,"HERAT","").map(x=>x.id),["b"]);
  assert.equal(searchOfflineTeams(teams,"","").length,3);
});
const competition=(id,status,acceptedTeams=1,maxTeams=8,startsAt="2026-10-21T08:00:00Z")=>({
  id,name:id,status,acceptedTeams,maxTeams,startsAt,
});
test("registration chooser excludes ongoing, finished, cancelled and full competitions",()=>{
  const data=[
    competition("draft","DRAFT"),
    competition("open","REGISTRATION_OPEN"),
    competition("closed","REGISTRATION_CLOSED"),
    competition("full","REGISTRATION_OPEN",8,8),
    competition("playing","IN_PROGRESS"),
    competition("done","COMPLETED"),
    competition("archived","ARCHIVED"),
    competition("cancelled","CANCELLED"),
    competition("scheduled","SCHEDULED"),
  ];
  assert.deepEqual(registerableOwnerCompetitions(data).map(x=>x.id),["closed","draft","open"]);
});
test("registration chooser sorts dated entries ahead of undated without mutating input",()=>{
  const data=[
    competition("undated","DRAFT",0,8,null),
    competition("later","REGISTRATION_OPEN",0,8,"2026-10-22T00:00:00Z"),
    competition("sooner","DRAFT",0,8,"2026-10-17T00:00:00Z"),
  ];
  assert.deepEqual(registerableOwnerCompetitions(data).map(x=>x.id),["sooner","later","undated"]);
  assert.equal(data[0].id,"undated");
});
