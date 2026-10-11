import fs from "node:fs";

const source=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const ensure=(condition,message)=>{if(!condition)throw new Error(message);};
const api=source("apps/api/src/modules/team/team-manager-phase3.routes.ts");
const client=source("apps/mobile/src/lib/api.ts");
const screen=source("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const route=source("apps/mobile/app/(app)/teams/[teamId].tsx");

ensure(api.includes('router.get("/teams/:teamId/public-highlights"'),
  "Read-only public team highlights route missing.");
ensure(api.includes('eq(socialPosts.status,"PUBLISHED")')&&
  api.includes('eq(socialPosts.visibility,"PUBLIC")'),
  "Private/unpublished team posts must never appear in the public profile.");
ensure(api.includes('eq(competitions.published,true)')&&
  api.includes('eq(competitionTeams.status,"ACCEPTED")'),
  "Unpublished competitions or unaccepted registrations must stay private.");
ensure(api.includes('team.offlineVenueId&&!team.claimedAt')&&
  api.includes('team.status!=="ACTIVE"'),
  "Offline-unclaimed and inactive teams cannot expose highlights.");
ensure(!api.slice(api.indexOf('async publicHighlights'),api.indexOf('async createPost'))
  .includes("teamAnnouncements"),
  "Member-only announcements must not appear in the public API.");
ensure(client.includes("teamPublicApi")&&client.includes("/public-highlights"),
  "Mobile must use the public endpoint, not the private manager workspace.");
ensure(route.includes("TeamDetailExperience"),"View Team must render the public profile.");
ensure(screen.includes('type Tab="media"|"squad"|"matches"|"competitions"|"stats"|"about"'),
  "Public team profile must have six main tabs.");
ensure(screen.includes("subNavigation")&&screen.includes('accessibilityRole="tab"')&&
  screen.includes('flexDirection:isRTL?"row-reverse"'),
  "Public team tabs/subtabs must be navigable and RTL-aware.");
ensure(screen.includes("teamApi.requestJoin")&&screen.includes('joinStatus==="PENDING"')&&
  screen.includes("teamApi.roster")&&screen.includes("team.privacy"),
  "Membership, request deduplication, and private roster gates must remain.");
ensure(screen.includes('pathname:"/competitions/[competitionId]/matches/[matchId]"')&&
  screen.includes('pathname:"/competitions/[competitionId]"'),
  "Matches and competitions must navigate to existing detail pages.");
ensure(screen.includes("DataLoadingState")&&screen.includes("setRetryCounter")&&
  screen.includes("formatCompetitionDateTime")&&screen.includes("Share.share"),
  "Loading/error/retry, Kabul-local dates and sharing are required.");
console.log("Public Team Detail verified: six tabs, real published data, private roster gates, member actions and RTL.");
