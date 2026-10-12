import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {formatAppClock,formatClock12From24Hour} from "../apps/mobile/src/lib/clock-display.ts";
import {formatLocalDateTime,formatLocalDateTimeParts,formatCompetitionDateTime,
  formatRefereeScheduleParts} from "../apps/mobile/src/lib/date-time.ts";
import {formatBookingSlot} from "../apps/mobile/src/lib/booking-confirm-display.ts";
import {formatSlotStartTime} from "../apps/mobile/src/lib/slot-display.ts";
import {formatCalendarTime} from "../apps/mobile/src/lib/timetable-calendar.ts";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const cases=[
  ["13:00","01:00 PM"],["18:30","06:30 PM"],["22:00","10:00 PM"],
  ["08:00","08:00 AM"],["00:00","12:00 AM"],["12:00","12:00 PM"],
  ["23:59","11:59 PM"],["01:05","01:05 AM"],
];
for(const [input,expected] of cases){
  assert.equal(formatClock12From24Hour(input),expected);
}
assert.equal(formatClock12From24Hour("not-a-clock"),"not-a-clock");
assert.equal(formatAppClock("2026-10-12T08:30:00Z","Asia/Kabul"),"01:00 PM");
assert.equal(formatAppClock("2026-10-12T14:00:00Z","Asia/Kabul"),"06:30 PM");
assert.equal(formatAppClock("2026-10-12T17:30:00Z","Asia/Kabul"),"10:00 PM");
assert.equal(formatAppClock("2026-10-12T03:30:00Z","Asia/Kabul"),"08:00 AM");
assert.equal(formatAppClock("2026-10-12T08:30:00Z","UTC"),"08:30 AM");
assert.equal(formatAppClock("2026-10-12T08:30:00Z","not/a-zone"),"01:00 PM");
assert.equal(formatAppClock("bad","Asia/Kabul"),"—");

const booking=formatBookingSlot("2026-10-12T08:30:00Z","fa-AF");
assert.equal(booking?.time,"01:00 PM");
assert.ok(booking?.day&&booking?.date,"Booking keeps localized day and date.");
assert.equal(formatSlotStartTime("2026-10-12T08:30:00Z","Asia/Kabul"),"01:00 PM");
assert.equal(formatCalendarTime("2026-10-12T08:30:00Z","ps-AF"),"01:00 PM");
for(const lang of ["en","fa-AF","ps-AF"]){
  const parts=formatLocalDateTimeParts("2026-10-12T08:30:00Z",lang);
  assert.equal(parts.time,"01:00 PM");
  assert.ok(parts.date);
  const combined=formatLocalDateTime("2026-10-12T08:30:00Z",lang);
  assert.ok(combined.includes("01:00 PM"));
  assert.ok(formatCompetitionDateTime("2026-10-12T08:30:00Z",lang).includes("01:00 PM"));
  const referee=formatRefereeScheduleParts("2026-10-12T08:30:00Z",lang);
  assert.equal(referee.time,"01:00 PM");
  for(const x of [parts.time,combined,referee.time])
    assert.ok(!/GMT|UTC|04:30|:\\d{2}:\\d{2}/i.test(x),"Visible time contains offset/seconds: "+x);
}

const dateTime=read("apps/mobile/src/lib/date-time.ts");
assert.ok(!dateTime.includes('timeZoneName: "short"'),"Do not show Greenwich offset.");
const picker=read("apps/mobile/src/components/ui/DateTimePickerField.tsx");
assert.ok(picker.includes('testID="datetime-period-toggle"')&&
  picker.includes('(draft.hour%12)||12')&&
  picker.includes('formatLocalDateTime(value,language)'));
assert.ok(!picker.includes('t("dateTime.afghanistanTime")'));
const timePicker=read("apps/mobile/src/components/ui/TimeOfDayPickerField.tsx");
assert.ok(timePicker.includes('testID="ampm-period-switch"')&&
  timePicker.includes('onChange(toInternal(draft))')&&
  timePicker.includes('formatClock12From24Hour(value)'));
const publicGrid=read("apps/mobile/src/components/venues/VenueSlotTimetable.tsx");
const ownerGrid=read("apps/mobile/app/(app)/owner/schedule.tsx");
for(const source of [publicGrid,ownerGrid]){
  assert.ok(source.includes("formatClock12From24Hour(time)"),"Timetable row headers should show AM/PM.");
  assert.ok(source.includes('date+"|"+time')||
    source.includes('rawTime(event.startsAt!)===time'),
    "Preserve 24h internal lookup keys.");
}
for(const file of [
  "apps/mobile/app/(app)/owner/timetable/edit.tsx",
  "apps/mobile/app/(app)/owner/timetable/exception.tsx",
  "apps/mobile/app/(app)/owner/manual-booking.tsx",
  "apps/mobile/app/(app)/owner/block-time.tsx",
  "apps/mobile/src/components/referee/RefereeDashboard.tsx",
]){
  const page=read(file);
  assert.ok(page.includes("<TimeOfDayPickerField"),
    "Missing AM/PM time entry on "+file);
}
for(const file of [
  "apps/mobile/app/(app)/owner/promotions/create.tsx",
  "apps/mobile/app/(app)/owner/promotions/index.tsx",
]){
  const page=read(file);
  assert.ok(page.includes("formatCompetitionDateTime("),
    "Promotions still show raw ISO time: "+file);
}
console.log("Global AM/PM time display verified: 12-hour examples, midnight/noon, Kabul venue clock, RTL languages, no GMT offsets, preserving internal 24h identifiers and input validation.");
