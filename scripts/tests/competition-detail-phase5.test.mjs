import assert from "node:assert/strict";
import {test} from "node:test";
import {competitionRegistrationSummary,eligibleCompetitionTeams,visibleCompetitionParticipations}
  from "../../apps/mobile/src/lib/competition-detail-teams.ts";
import {allowedCompetitionSubtabs,requestedCompetitionNavigation}
  from "../../apps/mobile/src/lib/competition-detail-navigation.ts";

const NOW=new Date("2026-10-15T08:00:00Z");
const team=(id,status="ACCEPTED")=>({teamId:id,status});
const cup=(input={})=>({status:"REGISTRATION_OPEN",registrationClosesAt:"2026-10-19T08:00:00Z",
  maxTeams:3,teams:[],...input});
const managed=(id,managerUserId="manager")=>({id,name:id,managerUserId});
const participant=(teamId,status)=>({
  teamId,teamName:teamId,status,feeStatus:"UNPAID",isManager:true,
  canWithdraw:false,canRespond:false,competitionId:"cup",
});
test("available slots reflect accepted teams, not invitations or pending applications",()=>{
 const value=competitionRegistrationSummary(cup({teams:[
   team("accepted"),team("applied","APPLIED"),team("invited","INVITED"),
 ]}),NOW);
 assert.equal(value.acceptedCount,1);
 assert.equal(value.remainingPlaces,2);
 assert.equal(value.submittedCount,3);
 assert.equal(value.state,"OPEN");
 assert.equal(value.availableForApply,true);
});
test("registration closes for complete capacity, including duplicate accepted records",()=>{
 const s=competitionRegistrationSummary(cup({maxTeams:1,teams:[team("one")]}),NOW);
 assert.equal(s.state,"FULL");
 assert.equal(s.remainingPlaces,0);
 assert.equal(s.availableForApply,false);
});
test("deadline closes at exact instant, including server-time crossing local midnight",()=>{
 const before=competitionRegistrationSummary(cup(),new Date("2026-10-19T07:59:59Z"));
 const after=competitionRegistrationSummary(cup(),new Date("2026-10-19T08:00:00Z"));
 assert.equal(before.state,"OPEN");
 assert.equal(after.state,"DEADLINE");
});
test("registration closed even when published slots remain and invalid dates do not fake expiry",()=>{
 assert.equal(competitionRegistrationSummary(cup({status:"REGISTRATION_CLOSED"}),NOW).state,"CLOSED");
 assert.equal(competitionRegistrationSummary(cup({status:"COMPLETED"}),NOW).availableForApply,false);
 assert.equal(competitionRegistrationSummary(cup({registrationClosesAt:"bad-date"}),NOW).state,"OPEN");
});
test("managed choices exclude already active registrations regardless of public/private state",()=>{
 const candidates=[managed("A"),managed("B"),managed("C"),managed("D")];
 const available=eligibleCompetitionTeams(candidates,cup({
   teams:[team("A","ACCEPTED"),team("B","INVITED")],
 }),[participant("C","PENDING")],"manager");
 assert.deepEqual(available.map(x=>x.id),["D"]);
});
test("other manager teams cannot be submitted, rejected and withdrawn teams can retry",()=>{
 const available=eligibleCompetitionTeams([managed("X","other"),managed("Y"),managed("Z")],
   cup({teams:[team("Y","REJECTED")]}),[participant("Z","WITHDRAWN")],"manager");
 assert.deepEqual(available.map(x=>x.id),["Y","Z"]);
});
test("invited, applied, pending and accepted personal states sort before historical states",()=>{
 const list=["WITHDRAWN","ACCEPTED","PENDING","REJECTED","INVITED","APPLIED"]
   .map(s=>participant(s,s));
 assert.deepEqual(visibleCompetitionParticipations(list).map(x=>x.status),
   ["INVITED","APPLIED","PENDING","ACCEPTED","REJECTED","WITHDRAWN"]);
 assert.deepEqual(list.map(x=>x.status),
   ["WITHDRAWN","ACCEPTED","PENDING","REJECTED","INVITED","APPLIED"]);
});
test("registration tab remains visible for full/deadline display while open status; personal status is separate",()=>{
 assert.deepEqual(allowedCompetitionSubtabs("TEAMS","LEAGUE",{registrationOpen:true}),
   ["PARTICIPANTS","REGISTRATION"]);
 assert.deepEqual(allowedCompetitionSubtabs("TEAMS","LEAGUE",{hasParticipation:true}),
   ["PARTICIPANTS","MY_PARTICIPATION"]);
 assert.deepEqual(allowedCompetitionSubtabs("TEAMS","LEAGUE",{registrationOpen:true,hasParticipation:true}),
   ["PARTICIPANTS","REGISTRATION","MY_PARTICIPATION"]);
});
test("legacy registration deep links still land on requested registration tab",()=>{
 const navigation=requestedCompetitionNavigation("TEAMS","REGISTRATION");
 assert.equal(navigation.main,"TEAMS");
 assert.equal(navigation.sub.TEAMS,"REGISTRATION");
});
