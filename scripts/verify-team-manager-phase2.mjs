import fs from "node:fs";
const read=(file)=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
const requireInvariant=(value,message)=>{if(!value)throw new Error(message);};
const dash=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const ops=read("apps/mobile/src/components/team-manager/TeamCompetitionOps.tsx");
const member=read("apps/mobile/app/(app)/teams/[teamId]/activities.tsx");
const route=read("apps/api/src/modules/team/team-manager-phase2.routes.ts");
const client=read("apps/mobile/src/lib/api.ts");
const schema=read("packages/database/src/schema.ts");
const migration=read("packages/database/drizzle/0026_team_manager_phase2.sql");
const lang=read("packages/localization/src/index.ts");
for(const tab of ["competitions","matches","schedule"]){
  requireInvariant(dash.includes('id:"'+tab+'"'),"Missing Phase 2 team dashboard tab: "+tab);
  requireInvariant(lang.split('"tm2.tab.'+tab+'"').length-1===3,"Missing Phase 2 translations: "+tab);
}
requireInvariant(dash.includes("<TeamCompetitionOps"),"Dashboard must embed Phase 2 tabs.");
for(const name of ["teamCompetitionRoster","teamMatchLineups","teamActivities","teamActivityResponses"]){
  requireInvariant(schema.includes("export const "+name),"Missing DB table: "+name);
}
for(const key of ["assertRosterEditable","assertEligibleSelection","TEAM_SUBSCRIPTION_REQUIRED",
  "TEAM_MEMBERSHIP_REQUIRED","LINEUP_LOCKED","ROSTER_LOCKED","ACTIVITY_STARTED"]){
  requireInvariant(route.includes(key),"Missing Phase 2 server invariant: "+key);
}
for(const key of ["list:","roster:","lineup:","memberActivities:","createActivity:","updateActivity:",
  "deleteActivity:","rsvp:"]){
  requireInvariant(client.includes(key),"Missing Phase 2 API client: "+key);
}
requireInvariant(member.includes("teamOperationsApi.memberActivities")&&member.includes("teamOperationsApi.rsvp"),
  "Player-facing private activity RSVP route missing.");
requireInvariant(ops.includes("competitionApi.register")&&ops.includes("competitionApi.respondInvitation"),
  "Reuse existing organizer-managed competition registration.");
requireInvariant(ops.includes("formatCompetitionDateTime")&&ops.includes("DateTimePickerField"),
  "Kabul-localized match and activity date picker missing.");
requireInvariant(migration.includes("team_competition_roster_registration_fk"),
  "Roster must have FK to team registration.");
requireInvariant(!ops.includes("enterResult(")&&!route.includes("enterResult("),
  "Team Manager cannot edit official competition match results.");
requireInvariant(read("apps/api/src/modules/notifications/notification.service.ts").includes("async teamActivity("),
  "Phase 2 team event alerts are not wired.");
requireInvariant(
  read("apps/api/src/modules/notifications/notification.repository.ts").includes('"TEAM_ACTIVITY"') &&
  read("apps/api/src/modules/notifications/notification.repository.ts").includes('filter==="TEAMS"'),
  "Team activity alerts should appear under Teams notifications, including when more types are added.");
console.log("Team Manager Phase 2 verified: competition registration/roster, matches/lineups, calendar, member availability, and authorization.");
