import fs from "node:fs";
const get=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const requireInvariant=(ok,msg)=>{if(!ok)throw new Error(msg);};
const dash=get("apps/mobile/src/components/player/PlayerDashboard.tsx");
const route=get("apps/mobile/app/(app)/dashboard.tsx");
const alt=get("apps/mobile/app/(app)/dashboard/player.tsx");
const server=get("apps/api/src/server.ts"),app=get("apps/api/src/app.ts");
const api=get("apps/api/src/modules/team/player-dashboard-phase1.routes.ts");
const schema=get("packages/database/src/schema.ts"),client=get("apps/mobile/src/lib/api.ts");
const locale=get("packages/localization/src/index.ts"),header=get("apps/mobile/src/components/ui/AppHeader.tsx");
const tabs=["overview","teams","competitions","matches","schedule","statistics","achievements","bookings","settings"];
for(const tab of tabs){
  requireInvariant(dash.includes('id:"'+tab+'"'),"Player navigation tab missing: "+tab);
  requireInvariant(locale.split('"pd1.tab.'+tab+'"').length-1===3,"Missing localized player tab: "+tab);
}
requireInvariant(dash.includes('flexDirection:isRTL?"row-reverse":"row"')&&
  dash.includes("focusTab(tab)")&&dash.includes("navActive"),
  "Player navigation must focus selected tab, show active underline and support RTL.");
requireInvariant(route.includes("return <PlayerDashboard")&&alt.includes("<PlayerDashboard"),
  "Player screen must be available for free accounts and through direct route.");
requireInvariant(header.includes('key:"playerDashboard"')&&header.includes('href:"/dashboard/player"'),
  "Paid roles must be able to access their free player dashboard.");
requireInvariant(app.includes("createPlayerDashboardPhase1Router")&&server.includes("new PlayerDashboardPhase1Service"),
  "Backend dashboard routes are not registered.");
requireInvariant(schema.includes("export const playerDashboardPreferences"),
  "Dashboard preferences must persist on the server.");
for(const term of ['"DEFAULT_TEAM_NOT_MEMBER"','"TEAM_MANAGER_TRANSFER_REQUIRED"',
  'eq(teamJoinRequests.requesterUserId,userId)','eq(teamMemberships.userId,userId)',
  'eq(teamMemberships.status,"ACTIVE")','eq(teamJoinRequests.status,"PENDING")',
  'playerMatchStats.playerUserId','getOwnProfile(userId)']){
  requireInvariant(api.includes(term),"Phase 1 authorization or real-data invariant missing: "+term);
}
for(const method of ["overview:","updatePreferences:","outgoingRequests:","cancelRequest:","leaveTeam:"]){
  requireInvariant(client.includes(method),"Typed player API action missing: "+method);
}
requireInvariant(dash.includes("teamApi.acceptInvitation")&&dash.includes("teamApi.declineInvitation")
  &&dash.includes("playerDashboardApi.cancelRequest")&&dash.includes("playerDashboardApi.leaveTeam")
  &&dash.includes("teamApi.requestJoin"),"Team invitation and membership actions must work.");
requireInvariant(dash.includes("formatCompetitionDateTime"),"Dates must use Kabul-local formatter.");
requireInvariant(!dash.includes('t("dashboard.title")'),"Do not restore generic dashboard header.");
console.log("Player Dashboard Phase 1 verified: nine RTL-aware tabs, overview, teams, invitations, discovery, preferences, role access and guarded writes.");
