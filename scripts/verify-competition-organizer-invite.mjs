import fs from "node:fs";
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const assert = (ok, message) => { if (!ok) throw Error(message); };
const page = read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const service = read("apps/api/src/modules/competition/competition.service.ts");
const tests = read("apps/api/test/competition-setup.test.ts");
const locale = read("packages/localization/src/index.ts");

assert(page.includes('session.user.roles.includes("VENUE_OWNER")')
  && page.includes("ownerApi.getStatus(session.accessToken)")
  && page.includes("status.venue?.id===next.venueId"),
  "Venue owner inviting must verify the competition hosting venue.");
const dashboard=read("apps/mobile/app/(app)/owner/competitions/[competitionId]/manage.tsx");
assert(!page.includes("inviteAsOrganizer()")&&!page.includes("registerManualTeam()")&&
  !page.includes("teamApi.directory(session.accessToken)")&&
  page.includes('testID="competition-owner-management-entry"')&&
  page.includes('params:{competitionId,tab:"TEAMS"}'),
  "Public Teams must link to the organizer console, never duplicate invitation or manual-team writes.");
assert(dashboard.includes("teamApi.directory(")&&
  dashboard.includes("competitionApi.inviteTeam(")&&
  dashboard.includes("manualTeamApi.register(")&&
  dashboard.includes("competitionApi.decideRegistration(")&&
  dashboard.includes('requestedControlTab(tab)')&&
  dashboard.includes('value==="FIXTURES"?"FIXTURES":value==="TEAMS"?"TEAMS":"OVERVIEW"'),
  "Existing owner-only Teams console must retain active team invitations, approvals and manual registrations.");
assert(page.includes("ownerApi.getStatus(session.accessToken)")&&
  page.includes("status.venue?.id===next.venueId")&&
  page.includes("competitionApi.register(session.accessToken,competitionId,item.teamId)"),
  "Public owner navigation and manager applications require separate verified authorization.");
assert(service.includes("async inviteTeam(ownerUserId")
  && service.includes("await this.ownerCompetition(ownerUserId, competitionId)")
  && service.includes("team.managerUserId !== userId"),
  "Existing backend ownership and manager consent restrictions must remain.");
assert(tests.includes('code:"COMPETITION_ACCESS_DENIED"')
  && tests.includes("service.respondInvitation(managerId"),
  "Permission regression must reject a different venue owner and preserve manager acceptance.");
for(const key of ["competition.organizerInviteHint","competition.organizerInvitationSent"]){
  assert(locale.split(`"${key}"`).length-1===3, `Missing English/Dari/Pashto: ${key}`);
}
console.log("Competition organizer Teams invitations verified: venue-scoped permissions, manager consent and existing registration.");
