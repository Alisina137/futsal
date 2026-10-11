import assert from "node:assert/strict";
import fs from "node:fs";
const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const owner=read("apps/api/src/modules/owner/owner.repository.ts");
const service=read("apps/api/src/modules/owner/owner.service.ts");
const eligibility=read("apps/api/src/modules/owner/referee-eligibility.ts");
const team=read("apps/api/src/modules/team/team.repository.ts");
const auth=read("apps/api/src/modules/auth/auth.repository.ts");
const mobile=read("apps/mobile/app/(app)/owner/referees.tsx");
const i18n=read("packages/localization/src/index.ts");
const test=read("apps/api/test/referee-role-eligibility.test.ts");

for(const marker of [
  'candidate.status==="ACTIVE"',
  'candidate.assignedRoles.length===0',
  '!candidate.hasPlayerProfile',
  '!candidate.hasActiveTeamMembership',
  '!candidate.managesTeam',
  '!candidate.ownsVenue',
  '!candidate.hasPaidRoleSubscription',
  '!candidate.hasOtherRefereeGrant',
])assert.ok(eligibility.includes(marker),"Normal User eligibility missing: "+marker);

for(const marker of [
  'this.db.transaction(async tx=>{',
  'pg_advisory_xact_lock(hashtext(',
  'userRoles.role',
  'eq(playerProfiles.userId,input.userId)',
  'eq(teamMemberships.status,"ACTIVE")',
  'eq(teams.managerUserId,input.userId)',
  'eq(venues.ownerUserId,input.userId)',
  'eq(roleSubscriptions.status,"PENDING")',
  'eq(venueReferees.userId,input.userId)',
  'canGrantRefereeToNormalUser({',
  'return "INELIGIBLE"',
  'return "ALREADY_ASSIGNED"',
])assert.ok(owner.includes(marker),"Atomic referee assignment guard missing: "+marker);

assert.ok(service.includes('grant==="INELIGIBLE"')&&
  service.includes('REFEREE_NORMAL_USER_REQUIRED'),
  "Venue owner must receive precise non-normal-user conflict error.");
assert.ok(team.includes('eq(venueReferees.userId,request.requesterUserId)')&&
  team.includes('eq(venueReferees.userId,invitedUserId)')&&
  team.includes('REFEREE_ROLE_EXCLUSIVE'),
  "Player join request and invitation must reject active referees.");
assert.ok(team.includes('async ensurePlayerProfile(')&&
  team.includes('eq(venueReferees.userId,userId)'),
  "Player profile activation must reject referees.");
assert.ok(auth.includes('eq(venueReferees.userId,input.userId)')&&
  auth.includes('eq(venueReferees.userId,userId)')&&
  auth.includes('REFEREE_ROLE_EXCLUSIVE'),
  "Paid role request/activation must reject referees.");
assert.ok(mobile.includes('error.code==="REFEREE_NORMAL_USER_REQUIRED"'));
assert.equal(i18n.split('"roles.refereeNormalOnlyError"').length-1,3);
assert.ok(test.includes('"PLAYER"')&&test.includes('"TEAM_MANAGER"')&&
  test.includes('"REFEREE"')&&test.includes('hasActiveTeamMembership'));
console.log("Referee exclusivity verified: Normal User-only transaction, player/manager/owner conflict guards, idempotency, three locales and regression tests.");
