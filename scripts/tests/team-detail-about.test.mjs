import {test} from "node:test";
import assert from "node:assert/strict";
import {teamAboutLocation,teamAboutFoundedDate,teamAboutVenueLink,
  teamAboutMembershipState,mayOpenTeamMemberArea} from
  "../../apps/mobile/src/lib/team-detail-about.ts";

const state=(role,joinStatus,action)=>teamAboutMembershipState({role,joinStatus,action});
test("member/manager status wins over stale join requests",()=>{
  assert.equal(state("MANAGER","PENDING","none"),"manager");
  assert.equal(state("CAPTAIN","REJECTED","none"),"captain");
  assert.equal(state("PLAYER","PENDING","none"),"player");
  assert.equal(state(null,"PENDING","cancel"),"pending");
});
test("sign in, verification, role restriction and invitation policy are distinct",()=>{
  assert.equal(state(null,null,"signIn"),"signIn");
  assert.equal(state(null,null,"verifyEmail"),"verifyEmail");
  assert.equal(state(null,null,"roleRestricted"),"roleRestricted");
  assert.equal(state(null,null,"invitationOnly"),"invitationOnly");
  assert.equal(state(null,null,"request"),"eligible");
});
test("rejected and cancelled requests do not misleadingly claim membership",()=>{
  assert.equal(state(null,"REJECTED","request"),"rejected");
  assert.equal(state(null,"CANCELLED","request"),"cancelled");
  assert.equal(state(null,"REJECTED","roleRestricted"),"roleRestricted");
});
test("only manager or confirmed member receives private member-area navigation",()=>{
  assert.equal(mayOpenTeamMemberArea({member:false,isManager:true}),true);
  assert.equal(mayOpenTeamMemberArea({member:true,isManager:false}),true);
  assert.equal(mayOpenTeamMemberArea({member:false,isManager:false}),false);
});
test("location removes repeated cities and blank fields without inventing locations",()=>{
  assert.equal(teamAboutLocation(" Kabul ","Kabul","KABUL"),"Kabul");
  assert.equal(teamAboutLocation("Herat",null,"Herat Province"),"Herat · Herat Province");
  assert.equal(teamAboutLocation(" ",null,""),"");
});
test("founded date localized as calendar day without timezone drift, invalid dates rejected",()=>{
  assert.ok(teamAboutFoundedDate("2021-03-21","en")?.includes("2021"));
  assert.ok(teamAboutFoundedDate("2021-03-21","fa-AF")?.length);
  assert.ok(teamAboutFoundedDate("2021-03-21","ps-AF")?.length);
  assert.equal(teamAboutFoundedDate("2021-02-29","en"),null);
  assert.equal(teamAboutFoundedDate("unknown","en"),null);
  assert.equal(teamAboutFoundedDate(null,"en"),null);
});
test("venue link is gated to published public profile and valid ID",()=>{
  const uuid="7f4dbe30-aa44-4a90-bc08-4209fae41abf";
  assert.equal(teamAboutVenueLink("PUBLIC",uuid),uuid);
  assert.equal(teamAboutVenueLink("PRIVATE",uuid),null);
  assert.equal(teamAboutVenueLink("PUBLIC","javascript:alert(1)"),null);
  assert.equal(teamAboutVenueLink("PUBLIC",null),null);
});
