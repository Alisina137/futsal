import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const repo=read("apps/api/src/modules/competition/competition.repository.ts");
const fake=read("apps/api/test/fake-competition-repository.ts");
const service=read("apps/api/src/modules/competition/competition.service.ts");
const routes=read("apps/api/src/modules/competition/competition.routes.ts");
const contracts=read("packages/contracts/src/index.ts");
const api=read("apps/mobile/src/lib/api.ts");
const detail=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const directory=read("apps/mobile/src/components/social/CompetitionDirectoryExperience.tsx");
const panel=read("apps/mobile/src/components/competition/CompetitionParticipationPanel.tsx");
const locales=read("packages/localization/src/index.ts");
assert.ok(contracts.includes("competitionParticipationDtoSchema")&&
 contracts.includes("competitionParticipationsResponseSchema")&&
 contracts.includes('phase:z.enum(["all","active","upcoming","history"])'),
 "Private team statuses and lifecycle filter must have typed API contracts");
assert.ok(routes.includes('router.get("/competitions/participation",auth,')&&
 routes.includes('router.get("/competitions/:competitionId/participation",auth,'),
 "Private participation endpoints must require the caller's valid session");
assert.ok(repo.includes("async listMyCompetitionParticipations(")&&
 repo.includes('eq(teamMemberships.userId,userId)')&&
 repo.includes('eq(teamMemberships.status,"ACTIVE")')&&
 repo.includes('eq(teams.managerUserId,userId)')&&
 repo.includes('eq(competitions.published,true)')&&
 repo.includes('isManager&&mutable&&row.status==="INVITED"'),
 "Personal application status must be scoped to active membership/manager without financial references");
assert.ok(repo.includes("async acceptRegistrationWithCapacity(")&&
 repo.includes('.for("update").limit(1)')&&
 repo.includes('eq(competitionTeams.status,"ACCEPTED")')&&
 repo.includes('throw errors.conflict("COMPETITION_FULL"')&&
 service.includes("await this.repository.acceptRegistrationWithCapacity({")&&
 fake.includes("async acceptRegistrationWithCapacity("),
 "Acceptance must lock competition capacity and recheck pending/accepted status");
assert.ok(repo.includes('filters.phase==="active"')&&
 repo.includes('filters.phase==="upcoming"')&&repo.includes('filters.phase==="history"'),
 "Lifecycle filters must run server-side before pagination");
assert.ok(api.includes('myParticipations:(accessToken:string,competitionId?:string)')&&
 api.includes('path.endsWith("/participation")'),
 "Private application responses must not come from stale offline cache");
assert.ok(directory.includes('mode==="mine"')&&
 directory.includes('testID="competitions-my-filters"')&&
 directory.includes("CompetitionParticipationPanel")&&
 directory.includes('competitionApi.respondInvitation(')&&
 directory.includes('competitionApi.withdraw('),
 "My Competitions must show actual application status, manager decisions and filters");
assert.ok(detail.includes("CompetitionParticipationPanel")&&
 detail.includes("competitionApi.myParticipations(session.accessToken,competitionId)")&&
 detail.includes('const registration=<View testID="competition-registration-experience"'),
 "Competition detail must show authenticated registration status outside the registration-open window.");
assert.ok(detail.includes('await competitionApi.register(')&&
 detail.includes('await competitionApi.respondInvitation(')&&
 detail.includes('await competitionApi.withdraw(')&&
 detail.includes('eligibleCompetitionTeams(myTeams,competition,participations,session.user.id)')&&
 detail.includes("participationError")&&detail.includes("setIntent(")&&
 detail.includes("const full=Boolean("),
 "Competition detail must prevent duplicate team actions, confirm submission and guard full capacity");
assert.ok(panel.includes("item.canRespond")&&panel.includes("item.canWithdraw")&&
 panel.includes("item.feeStatus")&&panel.includes("item.teamName"),
 "Registration panel must reflect backend permissions and payment status");
for(const key of ["competition.phase3.myRegistrations","competition.phase3.teamManager",
 "competition.phase3.teamMember","competition.phase3.feeStatus",
 "competition.phase3.accept","competition.phase3.decline","competition.phase3.withdraw",
 "competition.phase3.confirmRegister","competition.phase3.confirmWithdraw",
 "competition.phase3.registrationClosed","competition.phase3.reloadError",
 "competition.phase3.myParticipation","competition.phase3.history",
 "competition.phase3.upcoming","competition.phase3.active","competition.phase3.fullShort"]){
 assert.equal(locales.split('"'+key+'"').length-1,3,"English/Dari/Pashto missing: "+key);
}
assert.ok(read("apps/api/test/competition-phase3-registration.test.ts")
 .includes("scopes current and historical status"),"Integration tests must include cross-user privacy");
console.log("Competitions Phase 3 verified: private registration statuses, confirmed consent, locked capacity, eligible team actions, three-language UX.");
