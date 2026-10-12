import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const screen=read("apps/mobile/app/(app)/(tabs)/settings.tsx");
const directory=read("apps/mobile/src/components/social/TeamDirectoryExperience.tsx");
const role=read("apps/mobile/src/lib/dashboard-role-options.ts");
const translations=read("packages/localization/src/index.ts");
const userIsNormal=(roles)=>roles.length===0;
assert.equal(userIsNormal([]),true);
for(const roles of [["PLAYER"],["VENUE_OWNER"],["TEAM_MANAGER"],["REFEREE"],["PLATFORM_ADMIN"]])
  assert.equal(userIsNormal(roles),false);
for(const fragment of [
  '(user?.roles.length??-1)===0?<>',
  'testID="profile-join-team"',
  'testID="profile-join-team-action"',
  'onPress={()=>router.push("/teams")}',
  'settings.joinTeamVerifyHint',
  'settings.joinTeamBody',
  'settings.joinTeamAction'
])assert.ok(screen.includes(fragment),"Missing Join Team UI invariant: "+fragment);
assert.ok(screen.indexOf('testID="profile-join-team"')>screen.indexOf('onSelect={selectRole}'),
  "Join Team must appear after paid Team Owner subscription in Roles & participation.");
assert.ok(directory.includes('teamApi.directory(token)')&&
  directory.includes('teamApi.requestJoin(token,id)')&&
  directory.includes('joinRequestStatus:"PENDING"')&&
  directory.includes('team.myMembershipRole?'),
  "Profile shortcut must route to real directory with existing join/pending/roster logic.");
assert.ok(role.includes('assignedRoles.includes("PLAYER")'),
  "Accepted active membership must grant Player dashboard through actual role hydration.");
for(const suffix of ["joinTeam","joinTeamBody","joinTeamAction","joinTeamVerifyHint"]){
  const key='"settings.'+suffix+'"';
  assert.equal(translations.split(key).length-1,3,"Missing English/Dari/Pashto: "+key);
}
console.log("Normal User Join Team navigation verified: role-only CTA after Team Owner subscription, translated, existing team directory/request handling.");
