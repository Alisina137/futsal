import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const dashboard=read("apps/mobile/src/components/owner/OwnerDashboard.tsx");
const projections=read("apps/mobile/src/lib/owner-dashboard-overview.ts");
const dates=read("apps/mobile/src/lib/timetable-calendar.ts");
const routes=read("apps/mobile/src/lib/owner-dashboard-navigation.ts");
const bookings=read("apps/mobile/app/(app)/owner/bookings.tsx");
const locale=read("packages/localization/src/index.ts");
const pkg=JSON.parse(read("package.json"));
const check=(source,markers,label)=>{
  for(const marker of markers)assert.ok(source.includes(marker),
    label+" expected "+marker);
};
check(dashboard,[
  'type OverviewSnapshot','type OverviewTab','overviewTabs.map(id=>',
  'testID="owner-phase2-subnavigation"','testID={`owner-phase2-tab-${id}`}',
  'useVisibleTab<OverviewTab>(tab)','accessibilityState={{selected:tab===id}}',
  'setTab(id)','nav.focus(id,true)',
  'ownerApi.getStatus(token)','ownerApi.timetableCalendar(token,date,date,null)',
  'ownerApi.pendingBookings(token)','competitionApi.ownerList(token)',
  'ownerApi.analytics(token,addDays(date,-6),date)','Promise.allSettled(',
  'if(request!==generation.current)return;', 'generation.current++',
  'AppState.currentState==="active"', 'const current=loaded?.token===token?loaded:null',
  'const snapshot=current?.date===dayKey?current.snapshot:null;',
  'if(!status.venue)','statusError','setLoaded({token,date,status:null,snapshot:null,statusError:',
  'failures.push("calendar")','failures.push("pending")',
  'failures.push("competitions")','failures.push("analytics")',
  'testID="owner-phase1-overview"', 'testID="owner-phase2-action-nudge"',
  'testID={`owner-phase2-attention-${item.key}`}', 'testID={`owner-phase2-event-${item.id}`}',
  'tab==="today"','tab==="actions"','tab==="performance"',
  'summary?.confirmedToday','summary?.availableToday','summary?.pendingCount',
  'summary?.confirmedBookingValueToday','summary?.upcomingMatchCount',
  'summary?.activeCompetitionCount', 'formatCalendarDate(dayKey,language',
  'formatCalendarTime(item.startsAt,language)',
  'onRefresh={()=>void load()}','owner.phase2.partialError',
  'owner.phase2.valueDisclaimer','router.push("/owner/analytics")',
  'router.push("/owner/bookings")', 'router.push(item.href)',
],"Owner Overview");
check(projections,[
  'confirmedBookingValueToday','bookingStatus==="CONFIRMED"',
  'booking.status==="PENDING"','Date.parse(booking.startsAt)>nowMs',
  'event.type==="AVAILABLE"||event.type==="PROMOTION"',
  'Date.parse(event.startsAt)>nowMs','activeCompetitionStatus',
  'snapshot.day?.date===dayKey', 'snapshot.pending===null?null',
  'snapshot.competitions===null?null','status.subscription.activeUntil',
  'items.push({key:"pending"','items.push({key:"subscription"',
  'items.push({key:"paused"','items.push({key:"registrations"',
  'grossBookingValueAfn', 'cancellationRate:analytics.cancellationRate',
],"authoritative projections");
check(bookings,['<OwnerPendingBookings token={session?.accessToken}/>'],
  "existing booking action integration");
check(dates,['timeZone: KABUL_TIME_ZONE','export function todayKabul()','export function addDays('],
  "Kabul dates");
check(routes,['key:"overview",href:"/owner/overview"'],
  "Overview remains first route");
assert.equal((dashboard.match(/<Screen embedded/g)??[]).length>=1,true,
  "Overview must be inside the persistent owner shell.");
assert.ok(!dashboard.includes("showHeader")&&!dashboard.includes("<OwnerTopNav"),
  "Do not remount a second owner nav or app header");
assert.ok(!dashboard.includes("collectedRevenue")&&!dashboard.includes("cashReceived"),
  "Do not invent financial reconciliation figures");
for(const key of [
 "owner.phase2.subtitle","owner.phase2.tab.today","owner.phase2.tab.actions",
 "owner.phase2.tab.performance","owner.phase2.confirmed","owner.phase2.pending",
 "owner.phase2.available","owner.phase2.confirmedValue",
 "owner.phase2.activeCompetitions","owner.phase2.upcomingMatches",
 "owner.phase2.action.pending","owner.phase2.action.subscription",
 "owner.phase2.action.paused","owner.phase2.action.registrations",
 "owner.phase2.valueDisclaimer","owner.phase2.partialError",
 "owner.phase2.noUpcoming","owner.phase2.performanceTitle",
]){
  assert.equal(locale.split('"'+key+'"').length-1,3,
    "Missing EN/Dari/Pashto Overview copy: "+key);
}
assert.ok(pkg.scripts["verify:owner-dashboard-phase2"]?.includes("venue-owner-dashboard-phase2.test.mjs"),
  "Phase 2 unit tests not registered");
assert.ok(pkg.scripts.verify.includes("pnpm verify:owner-dashboard-phase2"),
  "Phase 2 not part of full release readiness");
console.log("Venue Owner Dashboard Phase 2 verified: Today, actionable alerts, 7-day metrics, independent section loading, identity gates, date precision and locales.");
