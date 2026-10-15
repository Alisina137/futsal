import assert from "node:assert/strict";
import {test} from "node:test";
import {ownerCompetitionGroups,ownerCompetitionOrders,ownerCompetitionGroup,
  ownerCompetitionOverviewCounts,selectOwnerCompetitions,ownerCompetitionOperations}
  from "../../apps/mobile/src/lib/owner-competition-management.ts";

const now=Date.parse("2026-10-15T12:00:00+04:30");
const comp=(id,name,status,format="LEAGUE",start="2026-10-20T12:00:00Z")=>({
 id,name,status,format,startsAt:start,venueName:"Host Venue",published:true,
 acceptedTeams:2,maxTeams:8,registrationFeeAfn:0,registrationClosesAt:null,
});
const data=[
 comp("1","Alpha","REGISTRATION_OPEN","LEAGUE","2026-10-18T09:00:00Z"),
 comp("2","Beta","IN_PROGRESS","KNOCKOUT","2026-09-01T09:00:00Z"),
 comp("3","Gamma","DRAFT","GROUP_KNOCKOUT",null),
 comp("4","Delta","COMPLETED","LEAGUE","2026-10-01T09:00:00Z"),
 comp("5","Epsilon","SCHEDULED","KNOCKOUT","2026-10-22T09:00:00Z"),
];
const query=(group="ALL",status="ALL",format="ALL",q="",order="NEXT")=>
 selectOwnerCompetitions(data,{group,status,format,query:q,order},now);

test("stable competition group and sort options",()=>{
 assert.deepEqual(ownerCompetitionGroups,["ALL","REGISTRATION","ACTIVE","DRAFTS","FINISHED"]);
 assert.deepEqual(ownerCompetitionOrders,["NEXT","LATEST","NAME"]);
 assert.equal(ownerCompetitionGroup("REGISTRATION_OPEN"),"REGISTRATION");
 assert.equal(ownerCompetitionGroup("DRAFT"),"DRAFTS");
 assert.equal(ownerCompetitionGroup("COMPLETED"),"FINISHED");
});
test("lifecycle group selects real registration, live and archived statuses",()=>{
 assert.deepEqual(query("REGISTRATION").map(x=>x.id),["1"]);
 assert.deepEqual(query("ACTIVE").map(x=>x.id),["1","5","2"]);
 assert.deepEqual(query("DRAFTS").map(x=>x.id),["3"]);
 assert.deepEqual(query("FINISHED").map(x=>x.id),["4"]);
});
test("combined status, format and accent-insensitive-case query stays scoped",()=>{
 assert.deepEqual(query("ALL","SCHEDULED","KNOCKOUT","eps").map(x=>x.id),["5"]);
 assert.deepEqual(query("ACTIVE","IN_PROGRESS","KNOCKOUT","beta").map(x=>x.id),["2"]);
 assert.equal(query("ALL","DRAFT","LEAGUE").length,0);
 assert.deepEqual(query("ALL","ALL","ALL","host venue","NAME").map(x=>x.name),
   ["Alpha","Beta","Delta","Epsilon","Gamma"]);
});
test("upcoming starts first; latest started and undated sort safely",()=>{
 assert.deepEqual(query().map(x=>x.id),["1","5","2","4","3"]);
 assert.deepEqual(query("ALL","ALL","ALL","","LATEST").map(x=>x.id),
   ["5","1","4","2","3"]);
});
test("authoritative list summary does not invent pending team counts",()=>{
 const result=ownerCompetitionOverviewCounts(data);
 assert.deepEqual(result,{total:5,active:3,registrationsOpen:1,drafts:1});
});
const match=(id,startsAt,status,refereeUserId=null)=>({
 id,startsAt,status,homeTeamId:"team-1",awayTeamId:"team-2",
 homeTeamName:"Home",awayTeamName:"Away",refereeUserId,
});
const detail={
 teams:[
  {status:"APPLIED"},{status:"PENDING"},{status:"ACCEPTED"},
  {status:"ACCEPTED"},{status:"REJECTED"},{status:"WITHDRAWN"},
 ],
 matches:[
  match("upcoming","2026-10-17T08:00:00Z","SCHEDULED"),
  match("past","2026-10-14T08:00:00Z","COMPLETED"),
  match("live","2026-10-15T05:00:00Z","IN_PROGRESS","referee"),
  match("future","2026-10-19T08:00:00Z","SCHEDULED","referee"),
  match("postponed",null,"POSTPONED"),
 ],
};
test("private detail yields actual application queue, accepted roster, unassigned future fixtures",()=>{
 const r=ownerCompetitionOperations(detail,now);
 assert.equal(r.pendingApplications,2);
 assert.equal(r.acceptedTeams,2);
 assert.equal(r.unassignedFixtures,1);
 assert.equal(r.unfinishedFixtures,4);
 assert.equal(r.nextMatch?.id,"live");
});
test("no next match must be null; completed fixtures and withdrawn applications excluded",()=>{
 assert.equal(ownerCompetitionOperations({teams:[{status:"WITHDRAWN"}],
  matches:[match("end","2026-10-10T08:00:00Z","COMPLETED")]},now).nextMatch,null);
});
