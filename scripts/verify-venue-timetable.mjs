import fs from "node:fs";

function read(path){
  return fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
}
function assert(value,message){
  if(!value)throw new Error(message);
}

const schema=read("packages/database/src/schema.ts");
const migration=read("packages/database/drizzle/0015_venue_timetable.sql");
const pricingMigration=read("packages/database/drizzle/0016_single_court_slot_pricing.sql");
const contracts=read("packages/contracts/src/index.ts");
const repository=read("apps/api/src/modules/timetable/timetable.repository.ts");
const service=read("apps/api/src/modules/timetable/timetable.service.ts");
const routes=read("apps/api/src/modules/timetable/timetable.routes.ts");
const booking=read("apps/api/src/modules/booking/booking.service.ts");
const bookingRepository=read("apps/api/src/modules/booking/booking.repository.ts");
const bookingRoutes=read("apps/api/src/modules/booking/booking.routes.ts");
const blockEditor=read("apps/mobile/app/(app)/owner/block-time.tsx");
const manualEditor=read("apps/mobile/app/(app)/owner/manual-booking.tsx");
const ownerSetup=read("apps/mobile/app/(app)/owner/onboarding.tsx");
const ownerService=read("apps/api/src/modules/owner/owner.service.ts");
const ownerRepository=read("apps/api/src/modules/owner/owner.repository.ts");
const publicVenue=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const bookingConfirm=read("apps/mobile/app/(app)/booking/confirm.tsx");
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
assert(pricingMigration.includes("venue_areas_one_active_per_venue_uq"),"Single-court migration must enforce one active court per venue.");
assert(pricingMigration.includes("ADD COLUMN IF NOT EXISTS price_afn"),"Slot-pricing migration must add timetable period price.");
assert(schema.includes('priceAfn: integer("price_afn").notNull()'),"Timetable period schema must persist slot price.");
assert(schema.includes("venue_areas_one_active_per_venue_uq"),"Database schema must enforce one active court per venue.");
assert(contracts.includes('.length(1, "A venue owner account can manage exactly one court.")'),"Venue setup contract must allow exactly one court.");
assert(contracts.includes("priceAfn: z.number().int().min(0).max(1_000_000)"),"Timetable period contract must require a slot price.");
assert(ownerService.includes("SINGLE_COURT_REQUIRED"),"Owner service must enforce the one-court account rule.");
assert(ownerRepository.includes("eq(venueAreas.active, true)"),"Owner status must expose only the active single court.");

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
assert(service.includes("period.priceAfn ?? area.basePriceAfn"),"Calendar availability must inherit weekly timetable period prices.");
assert(service.includes("return allowedPeriod"),"Timetable interval validation must return the matched priced period.");
assert(booking.includes("period.priceAfn ?? area.basePriceAfn"),"Public availability must use weekly timetable prices.");
assert(booking.includes("timetablePriceAfn"),"Manual bookings must inherit the weekly timetable price when not overridden.");
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
assert(schedule.includes("Initial page shell only"),"Page-level loading must stay separate from calendar range refreshes.");
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

assert(schedule.includes("weekSlotGrid"),"Timetable Week view must render a slot grid.");
assert(schedule.includes("timeRows=Array.from(new Set("),"Timetable Week view must divide the calendar into start-time rows.");
assert(schedule.includes("rawTime(event.startsAt!)===time"),"Timetable Week view must place events into their matching start-time slot.");
assert(schedule.includes("onSelectSlot(event,day.date)"),"Every populated Week slot must be clickable and preserve its exact calendar date.");
assert(schedule.includes("selectedSlot"),"Week/Day slot selection must open exact-slot management.");
assert(schedule.includes("<SlotManager"),"Week/Day slot clicks must open a management panel.");
assert(schedule.includes('t("schedule.manageSlot")'),"Week slot management panel must be clearly titled.");
assert(schedule.includes('t("schedule.slotColorGuide")'),"Week view must include a slot background-color guide.");
assert(schedule.includes('AVAILABLE:{background:"#DCFCE7"'),"Available slots must use a green background.");
assert(schedule.includes('ONLINE_BOOKING:{background:"#FEE2E2"'),"Online reservation slots must use a red background.");
assert(schedule.includes('MANUAL_BOOKING:{background:"#DBEAFE"'),"Manual reservation slots must use a blue background.");
assert(schedule.includes('COMPETITION:{background:"#FEF3C7"'),"Competition slots must use an amber background.");
assert(schedule.includes('BLOCKED:{background:"#E2E8F0"'),"Blocked slots must use a gray background.");
assert(schedule.includes('PROMOTION:{background:"#F3E8FF"'),"Promotion slots must use a distinct promotion background.");
assert(!schedule.includes("showAreaName"),"Week slots must not expose multi-court labels.");
assert(!schedule.includes('t("schedule.area")'),"Main timetable must not expose a court selector.");
assert(schedule.includes('event.priceAfn!==null?\`\${event.priceAfn} AFN\`:"—"'),"Week slots must display price instead of court name.");
assert(schedule.includes("formatCalendarTime(event.startsAt!,language)"),"Each Week slot must display its start time.");
assert(schedule.includes("styles.weekSlotPressed"),"Week slots must provide pressed-state feedback.");
assert(schedule.includes("function DaySlotView"),"Day view must render timetable entries as clickable slots.");
assert(schedule.includes("styles.daySlotTable"),"Day view must use a one-day timetable slot layout.");
assert(schedule.includes("slotPalette[event.type]"),"Day view must use the same status color palette as Week view.");
assert(schedule.includes("styles.daySlotButton"),"Every timed Day slot must be rendered as an interactive slot.");
assert(schedule.includes("styles.dayClosedSlot"),"Closed Day state must remain clickable for management.");
assert(schedule.includes("onSelectSlot(event,day.date)"),"Day and Week slots must open the same management flow with the exact calendar date.");
assert(schedule.includes("<SlotManager"),"Slot management must be shared by Day and Week views.");
assert(schedule.includes('event.type==="PROMOTION"'),"Slot manager must provide promotion-specific management.");
assert(schedule.includes('event.type==="COMPETITION"'),"Slot manager must provide competition-specific management.");
assert(schedule.includes('event.type==="CLOSED"'),"Closed-day state must open timetable management actions.");
assert(!manualEditor.includes('t("schedule.area")'),"Manual booking must not expose a court selector.");
assert(!blockEditor.includes('t("schedule.area")'),"Block time must not expose a court selector.");
assert(!exception.includes('t("schedule.exceptionArea")'),"Special hours must not expose court scope choices.");
assert(ownerSetup.includes("owner.stepAreaBody"),"Venue setup must explain the one-court account rule.");
assert(!publicVenue.includes("publicProfile.playingAreas"),"Public venue profile must not advertise multiple playing areas.");
assert(!bookingConfirm.includes("params.areaName"),"Booking confirmation must not expose a court name.");

assert(editor.includes("calendarInputDate"),"Weekly editor must display Solar Hijri form dates for Dari/Pashto.");
assert(!editor.includes("selectedAreaIds")&&!editor.includes("allAreas")&&!editor.includes('t("schedule.areaScope")'),"Weekly editor must not expose multi-court scope controls.");
assert(editor.includes('t("schedule.slotPrice")'),"Weekly editor must edit a price for every operating period.");
assert(editor.includes("priceAfn:String(period.priceAfn)"),"Weekly editor must load existing period prices.");
assert(editor.includes("priceAfn:defaultPrice"),"New weekly periods must inherit the single court base price.");
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
  "schedule.manageSlot",
  "schedule.slotColorGuideBody",
  "schedule.slotColorGuide",
  "schedule.slotPrice",
  "schedule.slotPriceHint",
  "schedule.validationPrice",
  "schedule.managePromotions",
  "schedule.manageCompetitions",
  "booking.availableSlot",
]){
  const count=localization.split(`"${key}"`).length-1;
  assert(count===3,`Timetable localization missing for ${key}; found ${count}.`);
}

console.log("Venue timetable verified: one court per owner venue, per-period slot pricing, priced Week/Day slot views, and status-aware exact-slot management.");
