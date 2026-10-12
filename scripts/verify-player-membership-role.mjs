import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rolesWithActiveTeamPlayer} from "../apps/api/src/modules/auth/player-role-from-teams.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const auth=read("apps/api/src/modules/auth/auth.repository.ts");
const team=read("apps/api/src/modules/team/team.repository.ts");
const session=read("apps/mobile/src/providers/AuthProvider.tsx");
const profile=read("apps/mobile/app/(app)/(tabs)/settings.tsx");
const header=read("apps/mobile/src/components/ui/AppHeader.tsx");
const access=read("apps/mobile/src/lib/dashboard-role-options.ts");
const joinTest=read("apps/api/test/team-join-request-actions.test.ts");
assert.deepEqual(rolesWithActiveTeamPlayer([],false),[],
  "Pending/rejected team requests must not grant Player.");
assert.deepEqual(rolesWithActiveTeamPlayer([],true),["PLAYER"],
  "Accepted team membership must grant Player without an explicit user_roles entry.");
assert.deepEqual(rolesWithActiveTeamPlayer(["REFEREE"],true),["REFEREE"],
  "Venue-appointed referee must never acquire Player.");
assert.deepEqual(rolesWithActiveTeamPlayer(["PLATFORM_ADMIN"],true),["PLATFORM_ADMIN"]);
assert.deepEqual(rolesWithActiveTeamPlayer(["TEAM_MANAGER"],false),["TEAM_MANAGER"],
  "Team Manager alone must not auto-select Player dashboard.");
assert.deepEqual(rolesWithActiveTeamPlayer(["TEAM_MANAGER"],true),["TEAM_MANAGER","PLAYER"]);
assert.deepEqual(rolesWithActiveTeamPlayer(["PLAYER"],false),["PLAYER"],
  "Existing explicit Player grants continue to work.");
for(const fragment of [
  "teamPlayerMemberships] = await Promise.all([",
  ".from(teamMemberships)",
  ".innerJoin(teams,eq(teamMemberships.teamId,teams.id))",
  'eq(teamMemberships.userId,userId)',
  'eq(teamMemberships.status,"ACTIVE")',
  'or(eq(teamMemberships.role,"PLAYER"),eq(teamMemberships.role,"CAPTAIN"))',
  'eq(teams.status,"ACTIVE")',
  'or(isNull(teams.offlineVenueId),isNotNull(teams.claimedAt))',
  "rolesWithActiveTeamPlayer(granted,teamPlayerMemberships.length>0)",
])assert.ok(auth.includes(fragment),"Authenticated role derivation missing "+fragment);
assert.ok(team.includes("async respondJoinRequest(")&&team.includes('status: "ACTIVE"')&&
  team.includes("async acceptInvitation("),
  "Both accepted join requests and invitations must continue to create active memberships.");
assert.ok(session.includes("const currentRoles = [...session.user.roles].sort()")&&
  session.includes("const nextRoles = [...user.roles].sort()")&&
  session.includes("if (currentRoles !== nextRoles) return refreshSession();"),
  "An authenticated client must acquire a fresh token when team-granted roles change.");
assert.ok(profile.includes("useFocusEffect(useCallback(()=>")&&
  profile.includes("void refreshRoleRef.current();")&&
  profile.includes("useRef(revalidate)"),
  "Visiting Profile must refresh the role after manager approval.");
assert.ok(header.includes("const hasDashboard=availableDashboardRoles(user?.roles??[]).length>0;")&&
  access.includes('assignedRoles.includes("PLAYER")'),
  "Hamburger Dashboard must appear after active membership grants Player.");
assert.ok(joinTest.includes('expect(roster.body.team.members.some((v:{userId:string})=>v.userId===player.userId)).toBe(accept)'),
  "Join acceptance must remain covered by the endpoint test.");
console.log("Role-after-team-acceptance verified: live accepted membership grants Player, removed/unscheduled membership does not, referee remains exclusive, profile and navigation update on refresh.");
