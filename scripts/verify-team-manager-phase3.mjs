import fs from "node:fs";
const read=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const dash=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const panel=read("apps/mobile/src/components/team-manager/TeamGrowthPanel.tsx");
const routes=read("apps/api/src/modules/team/team-manager-phase3.routes.ts");
const client=read("apps/mobile/src/lib/api.ts");
const schema=read("packages/database/src/schema.ts");
const lang=read("packages/localization/src/index.ts");
const notification=read("apps/api/src/modules/notifications/notification.service.ts");
for(const tab of ["media","statistics"]){
  assert(dash.includes('id:"'+tab+'"'),"Phase 3 tab missing: "+tab);
  assert(lang.split('"tm3.tab.'+tab+'"').length-1===3,"Phase 3 tab must be localized in three languages: "+tab);
}
assert(dash.includes('tab==="matches"')&&dash.includes("<TeamGrowthPanel"),
  "Friendly challenges must appear inside the existing Matches tab.");
assert(!dash.includes('t("dashboard.title")')&&!dash.includes('t("dashboard.subtitle")'),
  "Generic dashboard heading must remain removed.");
for(const table of ["teamFriendlyChallenges","teamAnnouncements"]){
  assert(schema.includes("export const "+table),"Missing Phase 3 schema table: "+table);
}
for(const name of ["createPost:","updatePost:","deletePost:","announcements:","createAnnouncement:",
  "deleteAnnouncement:","challenge:","decideChallenge:","cancelChallenge:"]){
  assert(client.includes(name),"Missing Phase 3 typed API action: "+name);
}
for(const property of ["TEAM_SUBSCRIPTION_REQUIRED","TEAM_MANAGER_REQUIRED","TEAM_MEMBER_REQUIRED",
  "POST_IMAGE_NOT_OWNED","assertFriendlyChallengeAllowed","aggregateCompletedMatches",
  'eq(socialPosts.entityType,"TEAM")','eq(socialPosts.entityId,teamId)',
  'eq(teamFriendlyChallenges.toTeamId,teamId)','eq(teamFriendlyChallenges.status,"PENDING")']){
  assert(routes.includes(property),"Missing Phase 3 security or integrity guard: "+property);
}
assert(panel.includes("marketingApi.uploadUserPostImage")&&panel.includes("teamGrowthApi.createPost"),
  "Team media needs actual upload and publish.");
assert(panel.includes("teamGrowthApi.createAnnouncement")&&panel.includes("teamGrowthApi.challenge"),
  "Team announcements and challenges must be actionable.");
assert(panel.includes("teamGrowthApi.decideChallenge")&&panel.includes("teamGrowthApi.cancelChallenge"),
  "Both friendly challenge sides need actions.");
assert(notification.includes("async teamChallenge(")&&notification.includes("async teamAnnouncement("),
  "Notifications for team growth operations missing.");
assert(read("apps/mobile/app/(app)/teams/[teamId]/announcements.tsx").includes("teamGrowthApi.announcements"),
  "Members-only announcement reader missing.");
assert(panel.includes("formatCompetitionDateTime"),"Dates must be localized to Kabul.");
assert(!routes.includes("updateMatchResult(")&&!routes.includes("enterResult("),
  "Team managers cannot record official match results.");
console.log("Team Manager Phase 3 verified: Media, Statistics, private announcements, friendlies, notifications, safe uploads and permissions.");
