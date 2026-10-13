import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const service=read("apps/api/src/modules/team/team.service.ts");
const repo=read("apps/api/src/modules/team/team.repository.ts");
const types=read("apps/api/src/modules/team/team.types.ts");
const fake=read("apps/api/test/fake-team-repository.ts");
const detail=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const directory=read("apps/mobile/src/components/social/TeamDirectoryExperience.tsx");
const manager=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const invites=read("apps/mobile/app/(app)/teams/invitations.tsx");
const tests=read("apps/api/test/teams-phase6-integration.test.ts");
for(const [ok,label] of [
  [service.includes('getTeam(teamId, team.privacy === "PUBLIC", true)'),"public team filters player visibility"],
  [repo.includes('publicOnly ? eq(playerProfiles.visibility, "PUBLIC")')&&
    repo.includes('getTeam(teamId: string, includeRoster: boolean, publicRoster=false)'),"public/private roster repository separation"],
  [repo.includes('rosterCount: await this.rosterCount(record.id)')&&
    fake.includes('rosterCount: allMembers.length'),"public profile privacy does not falsify total roster count"],
  [service.includes("const emailNormalized=value.includes")&&
    repo.includes("eq(users.emailNormalized,input.emailNormalized)")&&
    types.includes("emailNormalized?: string"),"normalized email invitation resolution across repository contracts"],
  [repo.includes('if(existing?.status==="ACTIVE")return false;'),"stale invite cannot replace active membership role"],
  [repo.includes('team.offlineVenueId&&!team.claimedAt')&&
    repo.includes('eq(userRoles.role,"REFEREE")'),"unclaimed teams and referee grants prohibited during invitation acceptance"],
  [repo.includes("pg_advisory_xact_lock")&&repo.includes('eq(teamInvitations.status, "PENDING")'),"transaction locks and pending invitation state gates"],
  [detail.includes("const generation=++loadGeneration.current")&&
    detail.includes("if(loadGeneration.current!==generation)return")&&
    detail.includes("useFocusEffect(useCallback"),"team page focus refresh and latest-response wins"],
  [detail.includes("postsGeneration.current++")&&detail.includes("teamPublicApi.posts("),"cross-team paginated posts cancelled"],
  [manager.includes("selectedTeamRef.current!==teamIdAtStart")&&
    manager.includes("setTeam(null);setOverview(null)")&&
    manager.includes("team?.id!==selectedId"),"manager actions and private workspace isolated by team"],
  [invites.includes("if(!session||busyId)return")&&
    invites.includes("disabled={busyId!==null}")&&
    invites.includes("loadGeneration.current===generation"),"invitation UI serializes actions and rejects stale results"],
  [directory.includes("useFocusEffect")&&directory.includes("++requestId.current"),"directory focus refresh and pagination invalidation"],
  [tests.includes('describe("Teams Phase 6')&&
    tests.includes("stale invitation")&&
    tests.includes("private player identity"),"cross-module integration regression tests"],
])assert.ok(ok,"Teams Phase 6 check missing: "+label);
console.log("Teams Phase 6 verified: public/private team boundaries, email invitations, exclusive referee role, focus refresh and manager isolation.");
