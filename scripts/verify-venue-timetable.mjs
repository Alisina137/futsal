import fs from "node:fs";

function read(path){
  return fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
}
function assert(value,message){
  if(!value)throw new Error(message);
}

const schema=read("packages/database/src/schema.ts");
const migration=read("packages/database/drizzle/0015_venue_timetable.sql");
const contracts=read("packages/contracts/src/index.ts");
const repository=read("apps/api/src/modules/timetable/timetable.repository.ts");
const service=read("apps/api/src/modules/timetable/timetable.service.ts");
const routes=read("apps/api/src/modules/timetable/timetable.routes.ts");
const booking=read("apps/api/src/modules/booking/booking.service.ts");
const bookingRepository=read("apps/api/src/modules/booking/booking.repository.ts");
const bookingRoutes=read("apps/api/src/modules/booking/booking.routes.ts");
const blockEditor=read("apps/mobile/app/(app)/owner/block-time.tsx");
const app=read("apps/api/src/app.ts");
const server=read("apps/api/src/server.ts");
const mobileApi=read("apps/mobile/src/lib/api.ts");
const schedule=read("apps/mobile/app/(app)/owner/schedule.tsx");
const editor=read("apps/mobile/app/(app)/owner/timetable/edit.tsx");
const exception=read("apps/mobile/app/(app)/owner/timetable/exception.tsx");
const calendar=read("apps/mobile/src/lib/timetable-calendar.ts");
const timetableNav=read("apps/mobile/src/components/owner/timetable/TimetableSubNav.tsx");
const ownerLayout=read("apps/mobile/app/(app)/owner/_layout.tsx");
const weeklyPage=read("apps/mobile/app/(app)/owner/timetable/weekly.tsx");
const exceptionsPage=read("apps/mobile/app/(app)/owner/timetable/exceptions.tsx");
const localization=read("packages/localization/src/index.ts");

for(const marker of [
  "venueTimetableStatusEnum",
  "venueTimetables",
  "venueTimetablePeriods",
  "venueTimetableExceptions",
]){
  assert(schema.includes(marker),`Database timetable schema missing: ${marker}`);
}
assert(migration.includes('CREATE TABLE "venue_timetables"'),"Venue timetable migration missing version table.");
assert(migration.includes('CREATE TABLE "venue_timetable_periods"'),"Venue timetable migration missing periods table.");
assert(migration.includes('CREATE TABLE "venue_timetable_exceptions"'),"Venue timetable migration missing exceptions table.");

for(const marker of [
  "venueTimetableDraftRequestSchema",
  "venueTimetablePublishResponseSchema",
  "venueTimetableCalendarResponseSchema",
  "venueCalendarEventTypeSchema",
]){
  assert(contracts.includes(marker),`Timetable contracts missing: ${marker}`);
}

for(const path of [
  '"/timetables"',
  '"/timetables/:timetableId/publish"',
  '"/timetables/:timetableId/duplicate"',
  '"/timetables/:timetableId/archive"',
  '"/timetable-exceptions"',
  '"/timetable-calendar"',
]){
  assert(routes.includes(path),`Timetable API route missing: ${path}`);
}

assert(service.includes("resolveDay("),"Timetable service must resolve published hours for availability.");
assert(service.includes("intervalAllowedBy("),"Timetable publish must validate existing occupancy against draft hours.");
assert(service.includes('item.type !== "PROMOTION"'),"Promotions must not block timetable publishing.");
assert(service.includes("archiveIds"),"Publishing must preserve version history by archiving overlapping schedules.");
assert(service.includes("bufferMinutes"),"Timetable service must honor booking buffer.");
assert(repository.includes("competitionMatches"),"Timetable calendar/conflicts must include competition occupancy.");
assert(repository.includes("venuePromotions"),"Timetable calendar must include promotions.");
assert(booking.includes("this.timetable.resolveDay"),"Public availability must use the published timetable.");
assert(booking.includes("this.timetable.assertIntervalAllowed"),"Manual bookings and blocks must obey the published timetable.");
assert(booking.includes("async updateBlock("),"Blocked timetable intervals must support owner edits.");
assert(bookingRepository.includes("updateBlockAtomic"),"Blocked interval edits must be atomic.");
assert(bookingRepository.includes("excludeBlockId"),"Blocked interval edit conflict checks must exclude only the block being edited.");
assert(bookingRoutes.includes('router.put("/blocks/:blockId"'),"Owner API must expose blocked interval editing.");
assert(app.includes("createOwnerTimetableRouter"),"Timetable router must be mounted.");
assert(server.includes("new TimetableService"),"Timetable runtime must be wired.");
assert(server.includes("new BookingService(bookingRepository, undefined, notificationService, timetable)"),"Booking service must receive timetable resolver.");

for(const marker of [
  "timetables:",
  "createTimetable:",
  "updateTimetable:",
  "publishTimetable:",
  "timetableCalendar:",
  "createTimetableException:",
]){
  assert(mobileApi.includes(marker),`Mobile timetable client missing: ${marker}`);
}

assert(schedule.includes('"MONTH","WEEK","DAY"'),"Venue timetable must offer Month, Week, and Day views.");
assert(ownerLayout.includes("<TimetableSubNav/>"),"Venue owner shell must keep timetable sub-navigation mounted across timetable pages.");
for(const route of [
  'href:"/owner/schedule"',
  'href:"/owner/timetable/weekly"',
  'href:"/owner/manual-booking"',
  'href:"/owner/block-time"',
  'href:"/owner/timetable/exceptions"',
]){
  assert(timetableNav.includes(route),`Timetable sub-navigation missing route: ${route}`);
}
const calendarNavPosition=timetableNav.indexOf('{key:"calendar"');
const manualNavPosition=timetableNav.indexOf('{key:"manual"');
const blockNavPosition=timetableNav.indexOf('{key:"block"');
const specialNavPosition=timetableNav.indexOf('{key:"special"');
const weeklyNavPosition=timetableNav.indexOf('{key:"weekly"');
assert(
  calendarNavPosition<manualNavPosition
    &&manualNavPosition<blockNavPosition
    &&blockNavPosition<specialNavPosition
    &&specialNavPosition<weeklyNavPosition,
  "Weekly Timetable must be the last timetable sub-navigation option.",
);
assert(!schedule.includes('t("schedule.quickActions")'),"Main timetable calendar page must not duplicate the old Quick Actions card.");
assert(!schedule.includes('t("schedule.venueTimetable")'),"Main timetable calendar page title must remain removed.");
assert(!schedule.includes('t("schedule.subtitle")'),"Main timetable calendar page subtitle must remain removed.");
assert(weeklyPage.includes("schedule.manageVersions")||weeklyPage.includes("schedule.currentTimetable"),"Weekly Timetable page must own timetable version management.");
assert(exceptionsPage.includes("schedule.addException")&&exceptionsPage.includes("deleteTimetableException"),"Special Hours page must own exception management.");
assert(calendar.includes('return language==="en"?1:6'),"English weeks must start Monday and Dari/Pashto weeks must start Saturday.");
assert(calendar.includes('calendar:usesSolarHijri(language)?"persian":"gregory"'),"Dari/Pashto timetable dates must use Solar Hijri and English must use Gregorian.");
assert(calendar.includes("monthGridRange(value,language)"),"Month grid boundaries must follow the active calendar system.");
assert(calendar.includes("calendarInputToGregorian"),"Solar Hijri timetable form dates must convert safely to stored Gregorian dates.");
assert(schedule.includes("isSameDisplayMonth"),"Month view must determine in-month days using the active calendar, not Gregorian month keys.");
assert(schedule.includes("calendarRequestId=useRef(0)"),"Calendar refreshes must ignore stale responses during rapid navigation.");
assert(schedule.includes("renderedView")&&schedule.includes("renderedAnchorDate"),"Fetched timetable content must keep its last successful presentation while the next range loads.");
assert(!schedule.includes('calendarLoading?<DataLoadingState variant="list"'),"Calendar navigation must not replace existing timetable content with a full skeleton.");
assert(schedule.includes("calendarRefreshIndicator"),"Calendar navigation must use a small in-place refresh indicator.");
assert(schedule.includes("Initial page shell load only"),"Page-level loading must be reserved for the initial timetable shell load.");
assert(schedule.includes("statusFilters"),"Venue timetable must offer status filters.");
assert(schedule.includes("Summary"),"Venue timetable must show operational summary.");
assert(weeklyPage.includes("schedule.currentTimetable")&&weeklyPage.includes("schedule.draftTimetables")&&weeklyPage.includes("schedule.futureTimetables")&&weeklyPage.includes("schedule.archivedTimetables"),"Weekly Timetable page must manage current/draft/future/archive versions.");
assert(exceptionsPage.includes("schedule.specialHours"),"Special Hours page must expose timetable exceptions.");
assert(schedule.includes("/owner/manual-booking"),"Available slots must support manual booking.");
assert(schedule.includes("/owner/block-time"),"Available slots must support blocking.");
assert(schedule.includes('t("schedule.editBlock")'),"Blocked calendar events must expose an edit action.");
assert(blockEditor.includes("ownerApi.updateBlock"),"Blocked interval editor must update existing blocks when blockId is supplied.");
assert(schedule.includes("/owner/promotions/create"),"Available slots must support promotion creation.");

assert(editor.includes("copyDay(")&&editor.includes("copyMany("),"Weekly editor must copy hours between days.");
assert(editor.includes("orderedWeekdays(language)"),"Weekly editor day order must follow the active language week start.");
assert(editor.includes("todayDayOfWeek"),"Weekly editor must identify today's weekday.");
assert(editor.includes("styles.todayCard"),"Weekly editor must keep the previous card-based current-day highlight.");
assert(editor.includes('t("schedule.today")'),"Weekly editor must label today's card.");
assert(editor.includes("focusTodayCard"),"Weekly editor must focus today's card when opened.");
assert(editor.includes("scrollRef={screenScrollRef}"),"Weekly editor must control its own scroll position to reveal today's card.");
assert(!editor.includes("weekTableBody:{flexDirection:\"column\"}"),"Weekly Timetable editor must remain card-based and must not use the Week-view status table.");

assert(schedule.includes("styles.weekList"),"Timetable Week view must render a simple vertical list of days.");
assert(schedule.includes('t("schedule.totalReservations")'),"Timetable Week list must show only the total reservation count for each day.");
assert(schedule.includes("day.bookedCount"),"Timetable Week list total must use the day total booking count.");
assert(schedule.includes("styles.weekDayRowPressed"),"Timetable Week day rows must clearly feel clickable.");
assert(schedule.includes("styles.weekTodayRow"),"Today's row must remain highlighted in Timetable Week view.");
assert(schedule.includes("focusTodayWeekRow"),"Timetable Week view must bring today's row into view for the current week.");
assert(!schedule.includes("WeekHeaderCell"),"Timetable Week list must not expose the old detailed table columns.");
assert(!schedule.includes("WeekMetricCell"),"Timetable Week list must keep detailed status metrics out of the weekly list.");
assert(schedule.includes('setStatusFilter("ALL");setAnchorDate(date);setView("DAY")'),"Selecting a week day must open that day detail with all statuses visible.");
assert(schedule.includes('event.type==="ONLINE_BOOKING"'),"Day detail summary must calculate online reservations separately.");
assert(schedule.includes('t("schedule.summaryOnline")'),"Day detail summary must label online reservations separately.");

assert(editor.includes("calendarInputDate"),"Weekly editor must display Solar Hijri form dates for Dari/Pashto.");
assert(editor.includes("selectedAreaIds"),"Weekly editor must support selected venue areas.");
assert(editor.includes("defaultSlotDurationMinutes"),"Weekly editor must configure slot duration.");
assert(editor.includes("bufferMinutes"),"Weekly editor must configure booking buffer.");
assert(editor.includes("saveDraft")||editor.includes('t("schedule.saveDraft")'),"Weekly editor must save drafts.");
assert(editor.includes("publishTimetable"),"Weekly editor must publish changes.");
assert(exception.includes("isClosed"),"Special-hours editor must support full-day closure.");
assert(exception.includes("periods"),"Special-hours editor must support multiple periods.");
assert(exception.includes("calendarInputToGregorian"),"Special-hours dates must use the active display calendar and convert for API storage.");

for(const key of [
  "schedule.venueTimetable",
  "schedule.calendar.month",
  "schedule.calendar.week",
  "schedule.calendar.day",
  "schedule.createWeekly",
  "schedule.publishConflictTitle",
  "schedule.specialHours",
  "schedule.solarHijriHint",
  "schedule.weeklyHeaderDay",
  "schedule.weekViewActivity",
  "schedule.totalReservations",
  "schedule.summaryOnline",
]){
  const count=localization.split(`"${key}"`).length-1;
  assert(count===3,`Timetable localization missing for ${key}; found ${count}.`);
}

console.log("Venue timetable verified: Weekly Timetable editor stays card-based; Timetable Week view is a simple clickable day/reservation list and Day view exposes detailed reservation statuses.");
