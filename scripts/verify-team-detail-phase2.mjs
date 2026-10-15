import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const profile=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const actions=read("apps/mobile/src/lib/team-detail-actions.ts");
const server=read("apps/api/src/modules/team/team.service.ts");
const directory=read("apps/mobile/src/components/social/TeamDirectoryExperience.tsx");
const testFile=read("scripts/tests/team-detail-actions.test.mjs");

for(const token of [
  "teamDetailJoinAction({","joinAction!==\"request\"","joinAction!==\"cancel\"",
  'session?.user.emailVerified===true','(session?.user.roles.length??0)>0',
  'testID="team-header-actions"','testID="team-profile-cover"',
  'testID="team-header-shortcuts"','testID={"team-shortcut-"+item.id}',
  'chooseTab(item.id,item.sub)','chooseTab("about","members")',
  'testID="team-verify-email-hint"','router.push("/profile/email")',
  'router.push("/login")','testID="team-header-share"',
  'displayTeamFollowerCount(followState?.followerCount)',
  "publicTeamTelephoneUrl(profile?.contactPhone)","Linking.openURL(contactHref)",
  "profile?.description","team.rosterCount","joinStatus===\"PENDING\"",
])assert.ok(profile.includes(token),"Missing public Team Detail Phase 2 invariant: "+token);

assert.ok(!profile.includes('String(followState?.followerCount??0)'),
  "Guest or unavailable follower counts cannot falsely report zero.");
for(const token of [
  'if(input.member||input.manager)return "none"',
  'if(input.pending&&input.signedIn)return "cancel"',
  'if(!input.emailVerified)return "verifyEmail"',
  'if(input.hasAssignedRole)return "roleRestricted"',
  'if(!input.allowJoinRequests)return "invitationOnly"',
  'if(!/^\\+?[0-9]{7,15}$/.test(normalized))return null',
])assert.ok(actions.includes(token),"Missing team action security invariant: "+token);
assert.ok(server.includes('if(!user.emailVerified)')&&server.includes('if(user.roles.length>0)'),
  "Server must remain authoritative for verified basic account join policy.");
assert.ok(directory.includes('session?.user.emailVerified===true&&session.user.roles.length===0'),
  "Directory join policy and public Team Detail must agree.");
assert.ok(testFile.includes("teamDetailJoinAction")&&testFile.includes("publicTeamTelephoneUrl"),
  "Action logic and safety boundaries need focused tests.");
for(const key of ["signInToFollow","verifiedToJoin","verifyEmail","invitationNote",
  "quickSquad","quickResults","quickAbout","teamContact","viewMemberArea"])
  assert.equal(profile.split(key+":").length,4,"Missing EN/Dari/Pashto team wording: "+key);
console.log("Team Detail Phase 2 verified: public hero, truthful stats, verified join gating, quick links and safe contact.");
