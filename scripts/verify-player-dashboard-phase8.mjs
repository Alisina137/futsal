import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const dashboard=read("apps/mobile/src/components/player/PlayerDashboard.tsx");
const activity=read("apps/mobile/src/components/player/PlayerActivityTabs.tsx");
const career=read("apps/mobile/src/components/player/PlayerCareerTabs.tsx");
const profileApi=read("apps/api/src/modules/team/player-dashboard-phase1.routes.ts");
const activityApi=read("apps/api/src/modules/team/player-dashboard-phase2.routes.ts");
const careerApi=read("apps/api/src/modules/team/player-dashboard-phase3.routes.ts");
const locale=read("packages/localization/src/index.ts");
const pkg=JSON.parse(read("package.json"));
const has=(source,marker,area)=>assert.ok(source.includes(marker),area+": "+marker);
// 8.1 / 8.2 — Navigation and overview.
const main=dashboard.slice(dashboard.indexOf("const sections:"),dashboard.indexOf("const emptyPreferences:"));
assert.deepEqual([...main.matchAll(/\{id:"([a-z]+)",icon:/g)].map(x=>x[1]),
  ["overview","teams","activity","career","settings"]);
for(const key of ["competitions","matches","schedule","bookings","statistics","achievements","history"])
  has(dashboard,'{id:"'+key+'",icon:',"player subtab");
for(const marker of ['testID="player-overview-content"',
  'testID="player-overview-stats"','testID="player-dashboard-quick-actions"',
  'data.nextMatch?','pendingInvites.length>0'])
  has(dashboard,marker,"player overview");
// 8.3 — Team membership action lifecycle.
for(const marker of ['teamApi.acceptInvitation','teamApi.declineInvitation',
  'teamApi.requestJoin','playerDashboardApi.cancelRequest','playerDashboardApi.leaveTeam',
  'confirmLeave===team.id','confirmDecline===invite.id',
  'confirmCancelRequest===req.id','canRequestJoin?<Button'])
  has(dashboard,marker,"my teams");
// 8.4 — Official activity/fixtures, personal booking/RSVP & Solar calendar.
for(const marker of ['tab==="competitions"','tab==="matches"','tab==="schedule"',
  'tab==="bookings"','actualScheduleConflicts(events)',
  'teamOperationsApi.rsvp(token,activity.teamId,activity.id,availability)',
  'bookingApi.cancel(token,b.id)','confirmCancel===b.id',
  'careerPeriod(day+"T12:00:00Z","fa-AF")',
  'moveCalendarCursor(previous,view,direction,isRTL)',
  'careerCalendarDate(cursor,language)','careerDateTime(value,language)'])
  has(activity,marker,"activity/calendar");
// 8.5 — Career scope, privacy, statistics and award sharing.
for(const marker of ['careerMonthlyTrend(visible,metric,language)',
  'careerPersonalBest(visible)','careerResults(visible,historyResult)',
  'if(data?.visibility!=="PUBLIC")return','testID="player-career-history"'])
  has(career,marker,"career");
// 8.6 — Settings draft safety and account controls.
for(const marker of ['playerPreferencesValid(preferences)',
  'normalizePlayerPreferences(preferences)','discardPreferences',
  'router.push("/profile/email")','router.push("/profile/credentials")',
  'router.push("/notifications/preferences")'])
  has(dashboard,marker,"settings");
// 8.7 — Every API requires authorization and data is tied to actor.
for(const marker of ['session?.user.emailVerified===true',
  '(session?.user.roles.length??0)===0',
  'const data=loadedActor===session?.user.id?storedData:null',
  'const stillCurrent=()=>actorIdRef.current===actorId'])
  has(dashboard,marker,"access control");
for(const [source,markers] of [
  [profileApi,['requireAuth(tokens)','getOwnProfile(userId)']],
  [activityApi,['requireAuth(tokens)','req.auth!.userId']],
  [careerApi,['requireAuth(tokens)','getOwnProfile(userId)']],
])for(const marker of markers)has(source,marker,"authenticated APIs");
// 8.8 — Async requests and partial data do not bleed across accounts.
for(const marker of ['const activeTokenRef=useRef(token)',
  'activityActor===token?storedData:null','bookingActor===token?storedBookings:[]',
  'if(!stillCurrent())return','setBookingError','setActivityError'])
  has(activity,marker,"request isolation");
for(const marker of ['const data=loadedToken===token?storedData:null',
  'if(activeTokenRef.current===requestToken)setError('])
  has(career,marker,"career isolation");
has(dashboard,'<DataLoadingState variant="dashboard"',"loading state");
has(dashboard,'label={t("common.retry")}',"retry");
// 8.9 — All navigation labels are localized in three languages.
for(const key of ["pd1.tab.overview","pd1.tab.teams","pd1.tab.activity",
  "pd1.tab.career","pd1.tab.settings","pd1.tab.schedule",
  "pd1.tab.statistics","pd2.myCalendar","pd3.matchHistory"])
  assert.equal(locale.split('"'+key+'"').length-1,3,
    "Missing three-language translation for "+key);
has(activity,'weekStartsOnSaturday?(week+1)%7:(week+6)%7',"RTL week starts");
has(dashboard,'flexDirection:isRTL?"row-reverse":"row"',"RTL navigation");
has(dashboard,'language==="en"?formatCompetitionDateTime(s,language):careerDateTime(s,language)',
  "Dari/Pashto Solar date presentation");
// 8.10 — Standalone verification is part of the full project gate.
has(pkg.scripts["verify:player-dashboard-phase8"],
  'scripts/tests/player-dashboard-phase8.test.mjs',"Phase 8 functional test");
has(pkg.scripts["verify:player-dashboard-phase8"],
  'scripts/verify-player-dashboard-phase8.mjs',"Phase 8 source audit");
has(pkg.scripts.verify,"pnpm verify:player-dashboard-phase8","root verification");
console.log("Player Phase 8 source audit: navigation, actions, auth, data isolation, dates and localization are wired.");
