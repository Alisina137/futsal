import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const screen=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const about=read("apps/mobile/src/lib/team-detail-about.ts");
const actions=read("apps/mobile/src/lib/team-detail-actions.ts");
const api=read("apps/api/src/modules/team/team-manager-phase1.routes.ts");
const tests=read("scripts/tests/team-detail-about.test.mjs");
for(const token of [
  'testID="team-about-overview"','testID="team-about-membership"',
  'testID="team-about-contact"','testID="team-about-home-venue"',
  'testID="team-about-member-resources"',
  'testID="team-about-membership-message"',
  'testID="team-about-join-action"','testID="team-about-sign-in"',
  'testID="team-about-verify-email"',
  'teamAboutLocation(team?.city??"",profile?.district,profile?.province)',
  'teamAboutFoundedDate(profile?.foundedOn,language)',
  'teamAboutVenueLink(team?.privacy??"PRIVATE",profile?.homeVenueId)',
  'teamAboutMembershipState({role,joinStatus,action:joinAction})',
  'mayOpenTeamMemberArea({member,isManager:role==="MANAGER"})',
  'member&&team.captainUserId===session.user.id',
  'team?.privacy==="PUBLIC"?publicTeamTelephoneUrl(profile?.contactPhone):null',
  'params:{venueId:homeVenueId}',
  'joinAction==="request"||joinAction==="cancel"',
  'joinAction==="signIn"','joinAction==="verifyEmail"',
  'onPress={()=>router.push("/profile/email")}',
  'pathname:"/teams/[teamId]/activities"',
  'pathname:"/teams/[teamId]/announcements"',
])assert.ok(screen.includes(token),"Phase 7 About UI invariant missing: "+token);
for(const token of [
  'if(input.role==="MANAGER")return "manager"',
  'if(input.role==="CAPTAIN")return "captain"',
  'if(input.action==="cancel"||input.joinStatus==="PENDING")return "pending"',
  'if(input.action==="roleRestricted")return "roleRestricted"',
  'input.joinStatus==="REJECTED"&&input.action==="request"',
  'if(teamPrivacy!=="PUBLIC"||!homeVenueId)return null',
  'return input.member||input.isManager',
  'date.toISOString().slice(0,10)!==value',
])assert.ok(about.includes(token),"Phase 7 About safety invariant missing: "+token);
for(const token of [
  'if(!input.emailVerified)return "verifyEmail"',
  'if(input.hasAssignedRole)return "roleRestricted"',
  'if(!input.allowJoinRequests)return "invitationOnly"',
])assert.ok(actions.includes(token),"Phase 7 role/email join gate missing: "+token);
assert.ok(api.includes('team.privacy!=="PUBLIC"')&&
  api.includes('const {allowJoinRequests:_,whatsappGroupUrl:_invite,...publicFields}=details'),
  "Public About must not retrieve private manager invitation links or unpublished profile.");
for(const key of [
  "aboutIntro","aboutDetails","aboutFoundedMissing","aboutLocationMissing",
  "aboutHomeVenue","aboutViewVenue","aboutContactTitle","aboutNoContact",
  "aboutContactInfo","aboutManageInfo","aboutMemberStatus","aboutMemberManager",
  "aboutMemberCaptain","aboutMemberPlayer","aboutMemberPending","aboutMemberSignIn",
  "aboutMemberVerify","aboutMemberRole","aboutMemberInvite","aboutMemberRejected",
  "aboutMemberCancelled","aboutMemberEligible","aboutSignIn","aboutMemberLinks",
  "aboutPrivateLinks","aboutManagerWorkspace",
])assert.equal(screen.split(key+":").length,4,"Missing EN/Dari/Pashto About wording: "+key);
assert.ok(tests.includes("only manager or confirmed member receives private member-area navigation")&&
  tests.includes("rejected and cancelled requests do not misleadingly claim membership"),
  "Membership/privacy tests missing.");
console.log("Team Detail Phase 7 verified: privacy-aware public About, accurate membership states, safe contact and member navigation.");
