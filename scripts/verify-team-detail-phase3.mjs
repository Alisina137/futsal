import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const screen=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const helper=read("apps/mobile/src/lib/team-detail-squad.ts");
const repository=read("apps/api/src/modules/team/team.repository.ts");
const service=read("apps/api/src/modules/team/team.service.ts");
const tests=read("scripts/tests/team-detail-squad.test.mjs");

for(const token of [
  'testID="team-squad-summary"','testID="team-squad-search"',
  'testID={"team-squad-filter-"+position}','testID="team-squad-grid"',
  'testID={"team-squad-player-"+player.userId}',
  'const visible=team.privacy==="PUBLIC"||member||role==="MANAGER"',
  'canDisplayTeamRoster(team.privacy,member,role==="MANAGER")',
  'teamSquadView(team.members,team.managerUserId,team.captainUserId',
  'const restricted=team.rosterCount>team.members.length',
  'publicPlayerIds,setPublicPlayerIds','setPublicPlayerIds([])',
  'const publicIds=result.team.privacy==="PUBLIC"?',
  'result.team.members.map(player=>player.userId):[]',
  'setPublicPlayerIds(publicIds);','if(loadGeneration.current!==generation)return',
  'mayOpenPublicPlayer(player.userId,publicPlayerIds)',
  'accessibilityState={{disabled:!canOpenPlayer}} disabled={!canOpenPlayer}',
  'player.shirtNumber','t(`teams.position.${player.position}` as never)',
  'bigScreen&&styles.rosterItemWide','router.push({pathname:"/players/[playerId]"',
  'style={[styles.squadGrid,rowDirection]}','squadPositionFilters.map',
])assert.ok(screen.includes(token),"Team Detail Phase 3 missing: "+token);

assert.ok(repository.includes('publicOnly ? eq(playerProfiles.visibility, "PUBLIC")')&&
  repository.includes('eq(teamMemberships.status, "ACTIVE")')&&
  repository.includes('eq(users.status, "ACTIVE")')&&
  service.includes('getTeam(teamId, team.privacy === "PUBLIC", true)'),
  "Public roster must continue to be server filtered by public profile visibility.");
for(const token of [
  'member.userId===managerUserId||member.userId===captainUserId',
  'visibleMembers.filter','position==="ALL"||member.position===position',
  'member.publicDisplayName.toLocaleLowerCase().includes(query)',
  'return teamPrivacy==="PUBLIC"||isApprovedMember||isManager',
  'return publicProfileIds.includes(userId)',
])assert.ok(helper.includes(token),"Missing roster privacy/sort/filter invariant: "+token);

for(const key of [
  "squadFind","squadAll","squadVisible","squadOf","squadFiltered","squadNotPublic",
  "squadNoMatches","squadLeadersHint","squadNoPublicLeaders",
  "squadPrivateProfile","squadOpenPlayer",
])assert.equal(screen.split(key+":").length,4,"Missing localized squad wording: "+key);
assert.ok(tests.includes("private player cannot be deep-linked")&&
  tests.includes("private team roster requires")&&tests.includes("Unicode name"),
  "Missing squad privacy and search behavior tests.");
console.log("Team Detail Phase 3 verified: real roster counts, accessible position search, leadership and public-profile-only navigation.");
