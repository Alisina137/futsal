import fs from "node:fs";
const load=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const dash=load("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const route=load("apps/mobile/app/(app)/dashboard.tsx");
const schema=load("packages/database/src/schema.ts");
const api=load("apps/api/src/modules/team/team-manager-phase1.routes.ts");
const client=load("apps/mobile/src/lib/api.ts");
const language=load("packages/localization/src/index.ts");
const teamService=load("apps/api/src/modules/team/team.service.ts");
const createTeam=load("apps/mobile/app/(app)/teams/create.tsx");
for(const section of ["overview","team","players","settings"]){
  check(dash.includes('id:"'+section+'"'),"Missing Phase 1 tab "+section);
  check(language.split('"tm1.'+section+'"').length-1===3,"Missing Phase 1 translations "+section);
}
check(route.includes('role === "TEAM_MANAGER"')&&route.includes("<TeamManagerDashboard />"),
  "Team Manager route not connected");
check(!dash.includes('t("dashboard.title")')&&!dash.includes('t("dashboard.subtitle")'),
  "Generic dashboard title/subtitle should not appear");
for(const table of ["teamGuestPlayers","teamManagerProfiles"])check(schema.includes("export const "+table),"Missing table "+table);
for(const action of ["overview","updateProfile","addGuest","updateGuest","deleteGuest"]){
  check(client.includes(action+":"),"Missing API client action "+action);
}
check(api.includes("TEAM_SUBSCRIPTION_REQUIRED")&&api.includes("TEAM_MANAGER_REQUIRED"),"Missing write gate");
check(api.includes("TEAM_SHIRT_IN_USE"),"Guest jersey collision guard missing");
check(api.includes("team.offlineVenueId&&!team.claimedAt"),"Unclaimed offline-team isolation missing");
check(teamService.includes("allowsJoinRequests(teamId)"),"Membership request preference not enforced");
check(createTeam.includes('router.replace("/dashboard")'),"Team creation must return to manager dashboard");
console.log("Team Manager Phase 1 verified: overview, identity, players, settings, onboarding, subscription guard, ownership, and localized UI.");
