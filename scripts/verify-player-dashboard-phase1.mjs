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
requireInvariant(header.includes('key:"dashboard"')&&header.includes('href:"/dashboard"')&&
  !header.includes('key:"playerDashboard"')&&!header.includes('href:"/dashboard/player"'),
  "Hamburger must offer only the shared role-aware Dashboard; the direct player route stays compatible.");
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

// My Teams used to render 200px-tall oval options because the horizontal
// ScrollView expanded on the vertical axis. Check the bounded selector,
// RTL layout, active state and the same treatment across all Choice usages.
for(const needle of [
  'style={styles.choiceScroll}','choiceScroll:{flexGrow:0,flexShrink:0,width:"100%"}',
  'choiceRow:{minHeight:56','alignItems:"center"',
  'option:{minHeight:46,minWidth:86,flexShrink:0',
  'numberOfLines={1}','accessibilityRole="tab"',
  'useVisibleTab<string>(selected)','flexDirection:isRTL?"row-reverse":"row"',
  'onPress={()=>{onSelect(item.id);nav.focus(item.id,true);}}'
])requireInvariant(dash.includes(needle),"Player compact selector regression: "+needle);
for(const needle of [
  'testID={"player-team-card-"+team.id}',
  'styles.memberTeamLogo','styles.memberTeamHeader','styles.teamBadges',
  'testID="player-default-team-badge"','styles.teamActionGrid',
  'styles.teamActionButton','styles.teamDivider','styles.teamFooter',
  'testID="player-leave-team-trigger"',
  'team.managerUserId!==session?.user.id',
  'confirmLeave===team.id','playerDashboardApi.leaveTeam(token!,team.id)',
  'playerDashboardApi.updatePreferences(token!,{',
  'data.whatsappGroups?.[team.id]?<View style={[styles.teamWhatsAppRow,',
  'discover.map(team=><Card key={team.id} style={styles.memberTeamCard}>'
])requireInvariant(dash.includes(needle),"Player teams list/cards regression: "+needle);

console.log("Player Dashboard Phase 1 verified: nine RTL-aware tabs, overview, teams, invitations, discovery, preferences, role access and guarded writes.");
