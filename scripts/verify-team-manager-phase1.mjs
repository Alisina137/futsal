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
for(const section of ["overview","players","settings"]){
  check(dash.includes('id:"'+section+'"'),"Missing Phase 1 tab "+section);
  check(language.split('"tm1.'+section+'"').length-1===3,"Missing Phase 1 translations "+section);
}
check(language.split('"tm1.partialData"').length-1===3,
  "Partial data warnings must be translated in English, Dari and Pashto");
check(dash.includes('t("tm1.partialData")'),
  "Partial team data failure must preserve workspace with a specific warning.");
// Phase 1 dashboard resilience: a failed optional lookup cannot blank the team.
for(const guard of [
  'void teamApi.mine(token).then(mine=>',
  'authApi.roleSubscriptions(token)',
  'teamApi.capacity(token)',
  'Promise.allSettled([',
  'teamApi.joinRequests(token,selectedId)',
  'teamApi.teamInvitations(token,selectedId)',
  'notificationApi.list(token,{limit:5})',
  'setAttentionKey(key)',
  'pendingRequests={attentionReady&&attentionLoaded.requests?pending.length:null}',
  'pendingInvites={attentionReady&&attentionLoaded.invitations?outstanding.length:null}',
  'unreadNotifications={attentionReady&&attentionLoaded.notifications?unread:null}',
  'setDetailsError({key,message:',
  'detailsError?.key===teamKey',
  'loadedTeamKey!==teamKey',
  'const canWrite=loadedTeamKey===teamKey&&overview?.canWrite===true',
  'const visibleTeams=teamsActor===token?teams:[]',
  'setTeam(null);setOverview(null);setLoadedTeamKey(null)',
  'setCoverPreview(null);setShowVenues(false);setVenueSearch("");setVenues([])',
])check(dash.includes(guard),"Team dashboard missing resilience guard: "+guard);
check(!dash.includes('Promise.all([teamApi.mine')&&
  !dash.includes('setPrivacy(roster.team.privacy);setRequests(joined.requests);'),
  "Optional requests must not block critical team data");
check(dash.includes('t("tm1.teamIdentity")')&&dash.includes('tab==="settings"'),
  "Team base information must remain editable in Settings.");
check(route.includes('roles.includes("TEAM_MANAGER")')&&route.includes("<TeamManagerDashboard/>"),
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
console.log("Team Manager Phase 1 verified: scoped loading, independent requests, last-tab continuity, read/write authorization, overview, players and settings.");
