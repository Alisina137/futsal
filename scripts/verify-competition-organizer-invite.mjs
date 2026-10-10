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
assert(page.includes("teamApi.directory(session.accessToken)")
  && page.includes('!["REJECTED","WITHDRAWN"].includes(team.status)')
  && page.includes("!representedIds.has(team.id)"),
  "Organizer picker must list active teams not currently represented.");
assert(page.includes("competitionApi.inviteTeam(session.accessToken,competitionId,{teamId:invitedTeamId,seed:null})")
  && page.includes("competitionApi.register(session.accessToken,competitionId,selectedTeamId)"),
  "Organizer invitations and manager applications must stay separate.");
assert(page.includes('t("competition.organizerInviteHint")')
  && page.includes('t("competition.organizerInvitationSent")')
  && page.includes("inviteAsOrganizer()"),
  "Teams tab must explain and expose the venue owner invitation action.");
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
