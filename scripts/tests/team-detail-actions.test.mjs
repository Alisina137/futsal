import assert from "node:assert/strict";
import {test} from "node:test";
import {teamDetailJoinAction,displayTeamFollowerCount,publicTeamTelephoneUrl} from
  "../../apps/mobile/src/lib/team-detail-actions.ts";

const defaults={
  signedIn:true,emailVerified:true,hasAssignedRole:false,
  member:false,manager:false,pending:false,allowJoinRequests:true,
};
test("verified role-free users can request, but others cannot",()=>{
  assert.equal(teamDetailJoinAction(defaults),"request");
  assert.equal(teamDetailJoinAction({...defaults,emailVerified:false}),"verifyEmail");
  assert.equal(teamDetailJoinAction({...defaults,hasAssignedRole:true}),"roleRestricted");
  assert.equal(teamDetailJoinAction({...defaults,signedIn:false}),"signIn");
  assert.equal(teamDetailJoinAction({...defaults,allowJoinRequests:false}),"invitationOnly");
});
test("manager and members never request; pending request may still be cancelled",()=>{
  assert.equal(teamDetailJoinAction({...defaults,manager:true}),"none");
  assert.equal(teamDetailJoinAction({...defaults,member:true}),"none");
  assert.equal(teamDetailJoinAction({...defaults,pending:true}),"cancel");
  assert.equal(teamDetailJoinAction({...defaults,pending:true,hasAssignedRole:true}),"cancel");
  assert.equal(teamDetailJoinAction({...defaults,pending:true,emailVerified:false}),"cancel");
  assert.equal(teamDetailJoinAction({...defaults,pending:true,member:true}),"none");
});
test("follower count is truthful when session is unavailable",()=>{
  assert.equal(displayTeamFollowerCount(null),"—");
  assert.equal(displayTeamFollowerCount(undefined),"—");
  assert.equal(displayTeamFollowerCount(0),"0");
  assert.equal(displayTeamFollowerCount(23),"23");
  assert.equal(displayTeamFollowerCount(-1),"—");
  assert.equal(displayTeamFollowerCount(NaN),"—");
});
test("published phone links reject schemes, separators and invalid numbers",()=>{
  assert.equal(publicTeamTelephoneUrl("+93 700-000-000"),"tel:+93700000000");
  assert.equal(publicTeamTelephoneUrl("0700000000"),"tel:0700000000");
  assert.equal(publicTeamTelephoneUrl(null),null);
  assert.equal(publicTeamTelephoneUrl(""),null);
  assert.equal(publicTeamTelephoneUrl("tel:+9300000000"),null);
  assert.equal(publicTeamTelephoneUrl("+93;ext=123"),null);
  assert.equal(publicTeamTelephoneUrl("123"),null);
});
