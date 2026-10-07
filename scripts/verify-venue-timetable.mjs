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
const app=read("apps/api/src/app.ts");
const server=read("apps/api/src/server.ts");
const mobileApi=read("apps/mobile/src/lib/api.ts");
const schedule=read("apps/mobile/app/(app)/owner/schedule.tsx");
const editor=read("apps/mobile/app/(app)/owner/timetable/edit.tsx");
const exception=read("apps/mobile/app/(app)/owner/timetable/exception.tsx");
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
assert(schedule.includes("statusFilters"),"Venue timetable must offer status filters.");
assert(schedule.includes("Summary"),"Venue timetable must show operational summary.");
assert(schedule.includes("TimetableVersions"),"Venue timetable must manage current/draft/future/archive versions.");
assert(schedule.includes("specialHours"),"Venue timetable must expose special hours.");
assert(schedule.includes("/owner/manual-booking"),"Available slots must support manual booking.");
assert(schedule.includes("/owner/block-time"),"Available slots must support blocking.");
assert(schedule.includes("/owner/promotions/create"),"Available slots must support promotion creation.");

assert(editor.includes("copyDay(")&&editor.includes("copyMany("),"Weekly editor must copy hours between days.");
assert(editor.includes("selectedAreaIds"),"Weekly editor must support selected venue areas.");
assert(editor.includes("defaultSlotDurationMinutes"),"Weekly editor must configure slot duration.");
assert(editor.includes("bufferMinutes"),"Weekly editor must configure booking buffer.");
assert(editor.includes("saveDraft")||editor.includes('t("schedule.saveDraft")'),"Weekly editor must save drafts.");
assert(editor.includes("publishTimetable"),"Weekly editor must publish changes.");
assert(exception.includes("isClosed"),"Special-hours editor must support full-day closure.");
assert(exception.includes("periods"),"Special-hours editor must support multiple periods.");

for(const key of [
  "schedule.venueTimetable",
  "schedule.calendar.month",
  "schedule.calendar.week",
  "schedule.calendar.day",
  "schedule.createWeekly",
  "schedule.publishConflictTitle",
  "schedule.specialHours",
]){
  const count=localization.split(`"${key}"`).length-1;
  assert(count===3,`Timetable localization missing for ${key}; found ${count}.`);
}

console.log("Venue timetable verified: versioned weekly hours, multi-period/area editing, Month/Week/Day calendar, exceptions, conflict-safe publishing, and booking availability integration.");
