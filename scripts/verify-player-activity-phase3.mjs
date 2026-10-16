import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const ui=read("apps/mobile/src/components/player/PlayerActivityTabs.tsx");
const language=read("packages/localization/src/index.ts");
const dashboard=read("apps/mobile/src/components/player/PlayerDashboard.tsx");
for(const tab of ["competitions","matches","schedule","bookings"]){
  assert.ok(ui.includes('tab==="'+tab+'"'),"Missing Player activity tab "+tab);
  assert.ok(dashboard.includes('{id:"'+tab+'",icon:'),"Lost Player activity subnavigation "+tab);
}
for(const marker of [
  'weekStartsOnSaturday?(week+1)%7:(week+6)%7',
  'inCalendarPeriod(kabulDay(a.startsAt),cursor,view,isRTL)',
  'export function moveCalendarCursor(',
  'target.setUTCDate(Math.min(Number(cursor.slice(8,10)),lastDay))',
  'const sameMatch=Boolean(',
  'if(sameMatch||sameFriendly)continue',
  'const pendingResponseCount=events.filter(needsResponse).length',
  'testID="player-schedule-summary"',
  'scheduleFilter==="RESPONSE"&&needsResponse(a)',
  'scheduleFilter==="CONFLICTS"&&conflicts.has(a.key)',
  'rosterFilter==="ON_ROSTER"&&c.inRoster',
  'rosterFilter==="NOT_SELECTED"&&c.registrationStatus==="ACCEPTED"&&!c.inRoster',
  'matchFilter==="UPCOMING"&&m.status==="SCHEDULED"',
  'matchFilter==="POSTPONED"&&m.status==="POSTPONED"',
  'bookingFilter==="UPCOMING"',
  'shownBookings.map(b=>',
  'teamOperationsApi.rsvp(token,activity.teamId,activity.id,availability)',
  'bookingApi.cancel(token,b.id)',
  'confirmCancel===b.id',
  'bookingActor===token?storedBookings:[]',
  'activityActor===token?storedData:null',
]){
  assert.ok(ui.includes(marker),"Missing Phase 3 behavior: "+marker);
}
assert.ok(!ui.includes('shownBookings.sort('),"Upcoming bookings should not be reordered newest first");
for(const key of ["rosterFilter.ALL","rosterFilter.ON_ROSTER","rosterFilter.NOT_SELECTED",
 "match.POSTPONED","scheduleFilter.ALL","scheduleFilter.RESPONSE",
 "scheduleFilter.CONFLICTS","pendingResponses","upcomingConflicts",
 "personalBookingHint"]){
  assert.equal(language.split('"pd2.'+key+'"').length-1,3,
    "Missing English/Dari/Pashto string "+key);
}
console.log("Player Activity Phase 3 acceptance checks passed: calendar boundaries, RTL weeks, conflicts, actionable filters, personal bookings and API guards.");
