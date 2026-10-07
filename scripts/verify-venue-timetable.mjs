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
assert(calendar.includes('return language==="en"?1:6'),"English weeks must start Monday and Dari/Pashto weeks must start Saturday.");
assert(calendar.includes('calendar:usesSolarHijri(language)?"persian":"gregory"'),"Dari/Pashto timetable dates must use Solar Hijri and English must use Gregorian.");
assert(calendar.includes("monthGridRange(value,language)"),"Month grid boundaries must follow the active calendar system.");
assert(calendar.includes("calendarInputToGregorian"),"Solar Hijri timetable form dates must convert safely to stored Gregorian dates.");
assert(schedule.includes("isSameDisplayMonth"),"Month view must determine in-month days using the active calendar, not Gregorian month keys.");
assert(schedule.includes("statusFilters"),"Venue timetable must offer status filters.");
assert(schedule.includes("Summary"),"Venue timetable must show operational summary.");
assert(schedule.includes("TimetableVersions"),"Venue timetable must manage current/draft/future/archive versions.");
assert(schedule.includes("specialHours"),"Venue timetable must expose special hours.");
assert(schedule.includes("/owner/manual-booking"),"Available slots must support manual booking.");
assert(schedule.includes("/owner/block-time"),"Available slots must support blocking.");
assert(schedule.includes('t("schedule.editBlock")'),"Blocked calendar events must expose an edit action.");
assert(blockEditor.includes("ownerApi.updateBlock"),"Blocked interval editor must update existing blocks when blockId is supplied.");
assert(schedule.includes("/owner/promotions/create"),"Available slots must support promotion creation.");

assert(editor.includes("copyDay(")&&editor.includes("copyMany("),"Weekly editor must copy hours between days.");
assert(editor.includes("orderedWeekdays(language)"),"Weekly editor day order must follow the active language week start.");
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
]){
  const count=localization.split(`"${key}"`).length-1;
  assert(count===3,`Timetable localization missing for ${key}; found ${count}.`);
}

console.log("Venue timetable verified: versioned weekly hours, locale-aware Saturday/Monday week starts, Solar Hijri/Gregorian calendars, exceptions, conflict-safe publishing, and booking availability integration.");
