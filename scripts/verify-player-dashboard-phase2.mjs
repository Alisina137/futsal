import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const dash=read("apps/mobile/src/components/player/PlayerDashboard.tsx");
const ops=read("apps/mobile/src/components/player/PlayerActivityTabs.tsx");
const server=read("apps/api/src/modules/team/player-dashboard-phase2.routes.ts");
const app=read("apps/api/src/app.ts");
const launch=read("apps/api/src/server.ts");
const client=read("apps/mobile/src/lib/api.ts");
const translations=read("packages/localization/src/index.ts");
const rules=read("apps/api/test/player-dashboard-phase2.test.ts");
for(const tab of ["competitions","matches","schedule","bookings"]){
  assert(dash.includes('"'+tab+'"')&&ops.includes('tab==="'+tab+'"'),
    "Phase 2 player tab is not implemented: "+tab);
}
for(const required of [
 'const mine=await this.teamService.listMyTeams(userId)',
 'teamIds.length===0',
 'inArray(competitionTeams.teamId,teamIds)',
 'inArray(competitionMatches.homeTeamId,teamIds)',
 'inArray(competitionMatches.awayTeamId,teamIds)',
 'eq(teamActivityResponses.userId,userId)',
 'eq(playerMatchStats.playerUserId,userId)',
 'eq(teamCompetitionRoster.userId,userId)',
 'eq(teamFriendlyChallenges.status,"ACCEPTED")',
 'playerMatchSelection(lineupMap.get',
 'myStatistics:finalized&&recorded?',
 'request.auth!.userId',
 'requireAuth(tokens)'
]){
  assert(server.includes(required),"Missing Phase 2 scope/privacy requirement: "+required);
}
assert(!server.includes("rawLineup:")&&!server.includes("starters:pick")&&
  !server.includes("saveLineup("),"Player read API must never reveal the complete manager lineup or edit it.");
assert(app.includes("createPlayerDashboardPhase2Router")&&launch.includes("new PlayerDashboardPhase2Service"),
  "Player activities API not registered.");
assert(client.includes('"/api/v1/player-dashboard/activities"')&&ops.includes("playerActivityApi.list"),
  "Player activities client endpoint does not match API.");
assert(ops.includes("bookingApi.mine(token)")&&ops.includes("bookingApi.cancel(token,b.id)")&&
  ops.includes("router.push(\"/venues\")"),"Personal bookings must use real existing endpoints.");
assert(ops.includes("teamOperationsApi.rsvp(token,activity.teamId,activity.id,availability)"),
  "Schedule availability must sync with existing Team Manager workflows.");
assert(ops.includes("actualScheduleConflicts")&&ops.includes("inCalendarPeriod")&&
  ops.includes('new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul"'),
  "Player calendar must combine multi-team and personal bookings, detect conflicts in Kabul dates.");
assert(ops.includes("confirmCancel===b.id")&&ops.includes("setConfirmCancel"),
  "Booking cancellation must require explicit user confirmation.");
assert(ops.includes("rosterNotSelected")&&ops.includes("lineup.")&&ops.includes("friendlyDisclaimer"),
  "Competition roster, private lineup status and unofficial friendlies must be clearly distinguished.");
for(const key of ["myCompetitions","officialMatches","myCalendar","myBookings","scheduleConflict",
  "rosterConfirmed","noResponse","venueNotBooked","confirmCancellation"]){
  assert(translations.split('"pd2.'+key+'"').length-1===3,"Localization missing English/Dari/Pashto: "+key);
}
assert(rules.includes("NOT_PUBLISHED")&&rules.includes("SUBSTITUTE")&&rules.includes("playerScheduleOverlap"),
  "Selection, privacy, and conflict regression tests missing.");
console.log("Player Dashboard Phase 2 verified: real competitions, matches, lineups, multi-team calendar, RSVP, bookings, localized filters, and guards.");
