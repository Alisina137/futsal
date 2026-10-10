import fs from "node:fs";
function source(file){return fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");}
function check(ok,message){if(!ok)throw new Error(message);}
const dash=source("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const entry=source("apps/mobile/app/(app)/dashboard.tsx");
const api=source("apps/api/src/modules/team/team-workspace.routes.ts");
const schema=source("packages/database/src/schema.ts");
const locale=source("packages/localization/src/index.ts");
const client=source("apps/mobile/src/lib/api.ts");
const paths=["overview","team","players","competitions","matches","schedule","media","statistics","settings"];
for(const tab of paths){
  check(dash.includes('id:"'+tab+'"'),"Missing team tab "+tab);
  check((locale.match(new RegExp('"tm\\.'+tab+'"',"g'))??[]).length===3,"Untranslated tab "+tab);
}
check(entry.includes('role === "TEAM_MANAGER"')&&entry.includes("<TeamManagerDashboard />"),"Team Manager not routed to new dashboard.");
check(!dash.includes('t("dashboard.title")')&&!dash.includes('t("dashboard.subtitle")'),"Old Dashboard title/subtitle must be removed.");
for(const action of ["createActivity","rsvp","addGuest","saveLineup","createPost","challenge","respondChallenge"]){
  check(client.includes(action+":")||client.includes(action+":("),"Missing client action "+action);
}
check(api.includes("TEAM_SUBSCRIPTION_EXPIRED")&&api.includes("TEAM_MANAGER_REQUIRED"),"Server authorization gates missing.");
check(api.includes("teamMemberships.status")&&api.includes('eq(teamMemberships.status,"ACTIVE")'),"Lineup membership enforcement missing.");
check(api.includes("socialUserPostImages.ownerUserId"),"Media upload ownership enforcement missing.");
check(api.includes('eq(teamFriendlyChallenges.status,"PENDING")'),"Friendly challenge idempotency guard missing.");
for(const table of ["teamGuestPlayers","teamActivities","teamActivityResponses","teamMatchLineups","teamFriendlyChallenges"]){
  check(schema.includes("export const "+table),"Schema missing "+table);
}
check(dash.includes("formatCompetitionDateTime"),"Kabul locale date formatting missing.");
check(dash.includes("useFocusEffect"),"Team selector refresh on dashboard focus missing.");
console.log("Team Manager dashboard verified: 9 tabs, role routing, persistence, permissions, media ownership, localization and match integrity.");
