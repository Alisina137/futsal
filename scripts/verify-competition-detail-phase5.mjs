import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const tabs=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const panel=read("apps/mobile/src/components/competition/CompetitionParticipationPanel.tsx");
const helper=read("apps/mobile/src/lib/competition-detail-teams.ts");
const owner=read("apps/mobile/app/(app)/owner/competitions/[competitionId]/manage.tsx");
const service=read("apps/api/src/modules/competition/competition.service.ts");
const locales=read("packages/localization/src/index.ts");
for(const marker of [
 'testID="competition-registration-experience"',
 'selectedSubtab==="REGISTRATION"&&summary&&competition',
 'selectedSubtab==="MY_PARTICIPATION"&&session',
 'participationError&&session',
 'testID="competition-owner-management-entry"',
 'ownerApi.getStatus(session.accessToken)',
 'status.venue?.id===next.venueId',
 'params:{competitionId,tab:"TEAMS"}',
 'eligibleCompetitionTeams(myTeams,competition,participations,session.user.id)',
 'visibleCompetitionParticipations(participations)',
 'competitionRegistrationSummary(competition)',
 'competitionApi.myParticipations(session.accessToken,competitionId)',
 'competitionApi.register(session.accessToken,competitionId,item.teamId)',
 'competitionApi.respondInvitation(',
 'competitionApi.withdraw(',
 'onPress={()=>void executeIntent()}',
 'const canApply=registrationOpen&&!full&&!participationError',
 'if(actor!==lastActorIdentity.current)return;',
]){
 assert.ok(page.includes(marker),"Phase 5 participant/authorization invariant missing: "+marker);
}
for(const marker of ["testID=\"competition-public-participants\"",
 'view==="REGISTRATION"?"competition-registration-subtab":"competition-my-participation-subtab"',
 'team.status==="ACCEPTED"',
 'if(activeTab==="TEAMS")return <CompetitionTeams competition={competition}',
 'view={subtab??"PARTICIPANTS"}',
 'team.offline?"text":"button"',
]){
 assert.ok(tabs.includes(marker),"Phase 5 separate tabs/public-only team roster missing: "+marker);
}
for(const marker of ['item.isManager&&item.canRespond','item.isManager&&item.canWithdraw',
 'item.feeStatus','item.status==="INVITED"','competition.detail.participationHint.']){
 assert.ok(panel.includes(marker),"Phase 5 must respect authoritative private status: "+marker);
}
for(const marker of ["competitionApi.inviteTeam(","manualTeamApi.register(","competitionApi.decideRegistration(",
 'tab==="TEAMS"?"TEAMS":"OVERVIEW"'])
 assert.ok(owner.includes(marker),"Organizer writes must exist only in authenticated owner dashboard: "+marker);
assert.ok(!page.includes("competitionApi.inviteTeam(")&&
  !page.includes("manualTeamApi.register(")&&
  !page.includes("teamApi.directory(session.accessToken)"),
  "Public Competition Detail must not duplicate organizer invitation/registration workflows.");
for(const marker of [
 'async apply(userId','async inviteTeam(ownerUserId',
 'async respondInvitation(', 'async withdraw(',
 'throw errors.conflict("REGISTRATION_DEADLINE_PASSED"',
 'throw errors.forbidden("TEAM_MANAGER_REQUIRED"',
 'await this.repository.acceptRegistrationWithCapacity(',
]){
 assert.ok(service.includes(marker),"Server authorization/capacity regression: "+marker);
}
for(const key of ["registrationDetails","registrationExplainer","signInToRegister",
 "noParticipation","organizerHeading","organizerHint","manageTeams","acceptedTeamsCount","viewTeams",
 "registrationState.OPEN","registrationState.CLOSED","registrationState.DEADLINE","registrationState.FULL",
 "participationHint.INVITED","participationHint.APPLIED","participationHint.PENDING",
 "participationHint.ACCEPTED","participationHint.REJECTED","participationHint.WITHDRAWN"]){
 assert.equal(locales.split('"competition.detail.'+key+'"').length-1,3,
   "Missing localized Phase5 EN/Dari/Pashto "+key);
}
assert.ok(helper.includes('team.managerUserId===currentUserId')&&
 helper.includes('competition.teams.filter(team=>pending.has(team.status))'),
 "Registration choice must exclude active registrations and unauthorized managers.");
console.log("Competition Detail Phase 5: private actions, manager consent, public participant gallery, organizer dashboard and EN/Dari/Pashto verified.");
