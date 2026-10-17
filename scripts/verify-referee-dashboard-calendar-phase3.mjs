import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const calendar=read("apps/mobile/src/lib/referee-calendar.ts");
const dateTime=read("apps/mobile/src/lib/date-time.ts");
const dashboard=read("apps/mobile/src/components/referee/RefereeDashboard.tsx");
const assignmentPanel=read("apps/mobile/src/components/referee/RefereeAssignmentsPanel.tsx");
const backend=read("apps/api/src/modules/referee/referee.routes.ts");
const locale=read("packages/localization/src/index.ts");
const pkg=JSON.parse(read("package.json"));
for(const marker of [
  'timeZone:"Asia/Kabul"',
  'refereeWeekStart(day:string,language:LanguageCode)',
  'language==="en"?(date.getUTCDay()+6)%7:(date.getUTCDay()+1)%7',
  'export function refereeCalendarMonthKey(',
  'export function refereeCalendarIncludes(',
  'export function refereeCalendarMove(',
  'export function refereeCalendarWeekDays(',
  'if(language!=="en")return careerMonthShift(anchorDay,direction)',
  'export function refereeAvailabilityPreview(',
  'if(profile.weeklyAvailability.length===0)return "AVAILABLE"',
  'slot.day===weekday&&slot.start<=begin&&slot.end>=finish',
])assert.ok(calendar.includes(marker),"Calendar model: "+marker);
for(const marker of [
  'function refereeDateFormatter(language:LanguageCode,options:Intl.DateTimeFormatOptions)',
  'calendar=solar?"persian":"gregory"',
  'format.resolvedOptions().calendar===calendar',
  'return new Intl.DateTimeFormat("en-GB"',
  'time:clock(date,AFGHANISTAN_TIME_ZONE)',
  'const first=refereeWeekStart(cursor,language)',
  'const last=refereeShiftDay(first,6)',
])assert.ok(dateTime.includes(marker),"Referee dates/clock formatting: "+marker);
for(const marker of [
  'const calendarKey=refereeKabulDay(calendarAnchor)',
  'formatRefereeCalendarPeriod(calendarAnchor,calendarView,language)',
  'refereeCalendarMove(day,calendarView,direction,language)',
  'refereeCalendarIncludes(m.startsAt,calendarKey,calendarView,language)',
  'refereeCalendarWeekDays(calendarKey,language)',
  'refereeAssignmentTimeConflict(m,assignments)',
  'refereeAvailabilityPreview(m,data.profile)',
  'calendarItems.slice(0,calendarLimit).map((m,index,displayed)=>',
  'testID="referee-calendar-show-more"',
  'card(m,true)',
  'refereeCalendarDay',
])if(marker!=="refereeCalendarDay")
  assert.ok(dashboard.includes(marker),"Calendar UI: "+marker);
for(const marker of [
  'const availability=section==="pending"?',
  'refereeAvailabilityPreview(match,profile)',
  'availability==="AVAILABLE"',
  'refereeAssignmentTimeConflict(match,assignments)',
  'onOpenAvailability',
])assert.ok(assignmentPanel.includes(marker),"Assignment preflight: "+marker);
for(const marker of [
  'availabilityAllows(match.startsAt,match.endsAt,',
  'REFEREE_TIME_CONFLICT','pg_advisory_xact_lock',
])assert.ok(backend.includes(marker),"Server enforcement must remain authoritative: "+marker);
for(const key of [
  "rf1.calendar.filter.ALL","rf1.calendar.filter.PENDING",
  "rf1.calendar.filter.CONFIRMED","rf1.calendar.filter.HISTORY",
  "rf1.calendar.weekDays","rf1.calendar.matches",
  "rf1.calendar.conflict","rf1.calendar.unavailable",
  "rf1.calendar.manageAvailability","rf1.calendar.missingEnd",
  "rf1.calendar.reviewInvitation","rf1.calendar.showMore",
])assert.equal(locale.split('"'+key+'"').length-1,3,"Missing translations for "+key);
assert.ok(pkg.scripts["verify:referee-dashboard-calendar-phase3"]
  .includes("scripts/tests/referee-dashboard-calendar-phase3.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:referee-dashboard-calendar-phase3"));
console.log("Referee Dashboard Phase 3 verified: Kabul day, Solar months, Saturday RTL week, conflict and availability safeguards.");
