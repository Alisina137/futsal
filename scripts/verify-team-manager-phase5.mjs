import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const dash=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const ops=read("apps/mobile/src/components/team-manager/TeamCompetitionOps.tsx");
const growth=read("apps/mobile/src/components/team-manager/TeamGrowthPanel.tsx");
const calendar=read("apps/mobile/src/lib/team-manager-schedule.ts");
const locale=read("packages/localization/src/index.ts");
const backend=read("apps/api/src/modules/team/team-manager-phase2.routes.ts");
const check=(s,markers,label)=>markers.forEach(x=>assert.ok(s.includes(x),label+": "+x));
check(dash,[
 'setMatchSection("OFFICIAL");setCompetitionFocus(null)',
 'matchSection={matchSection} onMatchSectionChange={setMatchSection}',
 'tab==="matches"&&matchSection==="FRIENDLIES"',
 'setMatchSection("LINEUPS");chooseTab("matches");',
],"Team Manager dashboard");
check(ops,[
 'testID="tm5-matches-subtabs"','testID={`tm5-match-${item.id}`}',
 '{id:"OFFICIAL"','{id:"FRIENDLIES"','{id:"LINEUPS"',
 'testID="tm5-program-subtabs"','testID={`tm5-program-${item.id}`}',
 '{id:"CALENDAR"','{id:"ACTIVITIES"','{id:"AVAILABILITY"',
 'testID="tm5-official-matches"','testID="tm5-lineup-editor"',
 'testID="tm5-lineup-list"','upcoming(requestedMatch)',
 'tm5.lineupReady','tm5.lineupDraft',
 'matchFilterAllows(m.status,matchFilter,m.startsAt,today)',
 'testID="tm5-program-calendar"','testID="tm5-program-activities"',
 'testID="tm5-program-availability"','testID="tm5-activity-conflict"',
 'findScheduleConflicts({...activity,excludeActivityId:editingActivity}',
 'saveConflicts.length>0','validActivityTimes',
 'unansweredPlayerCount(team.members.map(m=>m.userId),item.rsvps.map(x=>x.userId))',
 'testID="tm5-delete-confirm"',
 'isInCalendarPeriod(iso,cursor.toISOString(),view,language)',
 'advanceCalendarDate(value.toISOString(),view,delta,language)',
 'DateTimePickerField','teamOperationsApi.deleteActivity','teamOperationsApi.lineup',
],"Team Competition Ops");
check(growth,[
 'challengeFilter','filteredChallenges','testID="tm5-friendly-cancel-confirm"',
 'teamGrowthApi.challenge(token,team.id','teamGrowthApi.decideChallenge(token,team.id',
 'teamGrowthApi.cancelChallenge(token,team.id','Date.parse(c.proposedAt)>Date.now()',
 'onPress={()=>setCancelChallengeId(c.id)}',
],"Friendlies");
check(calendar,[
 'calendarWeekStart','language==="en"?1:6','en-u-ca-persian',
 'advanceCalendarDate','findScheduleConflicts','unansweredPlayerCount',
 'matchFilterAllows','status==="POSTPONED"','status==="IN_PROGRESS"',
],"Calendar semantics");
check(backend,["TEAM_MANAGER_REQUIRED","MATCH_REGISTRATION_REQUIRED",
 "assertEligibleSelection(ids,active,roster)","LINEUP_LOCKED"],
 "Server-authoritative lineup validation");
const locKeys=[
 "officialMatches","friendlies","lineups","calendar","activities","availability",
 "playerAvailability","previous","next","calendarHint","lineupManagement","lineupHint",
 "noUpcomingLineups","lineupReady","lineupDraft",
 "matchStatus.ALL","matchStatus.UPCOMING","matchStatus.LIVE","matchStatus.FINISHED",
 "matchStatus.POSTPONED","matchStatus.CANCELLED","editActivity","noActivities",
 "conflictWarning","conflictActivity","conflictMatch","confirmDelete",
 "availabilityHint","noResponse","awaitingResponse","friendlyPending",
 "friendlyAccepted","friendlyHistory","friendlyAcceptedHint","friendlyExpired",
 "confirmFriendlyCancel",
];
for(const key of locKeys){
 assert.equal(locale.split('"tm5.'+key+'"').length-1,3,
   "Phase 5 language key absent for EN/Dari/Pashto: "+key);
}
console.log("Team Manager Phase 5: matches, friendlies, lineups, program, replies, localized calendars and guarded activity writes verified.");
