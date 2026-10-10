import fs from "node:fs";
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
const schema=read("packages/database/src/schema.ts");
const sql=read("packages/database/drizzle/0024_offline_competition_teams.sql");
const service=read("apps/api/src/modules/manual-team/manual-team.service.ts");
const routes=read("apps/api/src/modules/manual-team/manual-team.routes.ts");
const team=read("apps/api/src/modules/team/team.service.ts");
const repo=read("apps/api/src/modules/team/team.repository.ts");
const marketing=read("apps/api/src/modules/marketing/marketing.repository.ts");
const competition=read("apps/api/src/modules/competition/competition.service.ts");
const publicTeams=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const compPage=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const ownerNav=read("apps/mobile/src/components/owner/OwnerTopNav.tsx");
const ownerPage=read("apps/mobile/app/(app)/owner/manual-teams.tsx");
const admin=read("apps/mobile/src/components/admin/ManualTeamsAdminSection.tsx");
const strings=read("packages/localization/src/index.ts");

assert(schema.includes('offlineVenueId: uuid("offline_venue_id")') && schema.includes('claimedAt: timestamp("claimed_at"'),"Offline teams must persist provenance and claim state");
assert(sql.includes("offline_venue_id")&&sql.includes("claimed_at"),"Migration must add offline columns");
assert(service.includes('managerUserId: ownerUserId, offlineVenueId: venue.id')&&!service.includes("await this.createTeam"),"Offline teams must be venue-managed, not paid teams");
assert(service.includes('status: "ACCEPTED"')&&service.includes('.for("update")')&&service.includes('competition.maxTeams'),"Direct registration must be accepted with lock/capacity enforcement");
assert(service.includes("competition.venueId !== venue.id")&&service.includes("eq(teams.offlineVenueId, venue.id)"),"Cross-venue registration prohibited");
assert(routes.includes('router.use(requireAuth(tokens),requireRole("VENUE_OWNER"))')&&routes.includes('router.use(requireAuth(tokens),requireRole("PLATFORM_ADMIN"))'),"Owner and admin routes must be role-protected");
assert(service.includes('eq(users.usernameNormalized, usernameNormalized), eq(users.phoneE164, phoneE164)')&&service.includes('eq(roleSubscriptions.role, "TEAM_MANAGER")')&&service.includes('gt(roleSubscriptions.activeUntil, this.now())'),"Claim needs same-account username+phone and active paid subscription");
assert(service.includes("tx.insert(teamMemberships)")&&service.includes("managerUserId: user.id, claimedAt: now")&&service.includes("OFFLINE_TEAM_CLAIM"),"Claim must keep same team ID, transfer manager and audit");
assert(team.includes("(team.offlineVenueId && !team.claimedAt)")&&repo.includes('or(isNull(teams.offlineVenueId), isNotNull(teams.claimedAt))'),"Unclaimed teams must lack public profiles, directory entries and team-account controls");
assert(marketing.includes('or(isNull(teams.offlineVenueId), isNotNull(teams.claimedAt))'),"Unclaimed teams must not support social profile/follow/post");
assert(competition.includes("(team.offlineVenueId && !team.claimedAt)")&&publicTeams.includes('disabled={team.offline}'),"Offline teams cannot masquerade as subscribed teams or expose page links");
assert(ownerNav.includes('href:"/owner/manual-teams"')&&ownerPage.includes("manualTeamApi.create")&&ownerPage.includes("manualTeamApi.update"),"Offline teams managed from venue-owner dashboard");
assert(compPage.includes("manualTeamApi.register")&&admin.includes("adminApi.assignManualTeam"),"Competition enrollment and administrator handover UI");
for(const key of ["manualTeams.title","manualTeams.registerDirect","manualTeams.adminTitle","manualTeams.claimRules","competition.manualTeamBadge"]){
 assert(strings.split(`"${key}"`).length-1===3,`Missing language label: ${key}`);
}
console.log("Offline team workflow verified: organizer creation and direct enrollment, public/social isolation, admin handover and localization.");
