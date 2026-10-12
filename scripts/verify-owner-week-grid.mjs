import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {missingWeekCellKind,ownerCalendarClock} from "../apps/mobile/src/lib/owner-week-grid.ts";
import {formatClock12From24Hour} from "../apps/mobile/src/lib/clock-display.ts";
const src=readFileSync(new URL("../apps/mobile/app/(app)/owner/schedule.tsx",import.meta.url),"utf8");
const en=(day,events)=>({closed:day,events});
const event=(starts,ends)=>({
  startsAt:starts,endsAt:ends,type:"MANUAL_BOOKING",
});
assert.equal(ownerCalendarClock("2026-10-12T03:30:00.000Z"),"08:00");
assert.equal(ownerCalendarClock("2026-10-12T09:00:00.000Z"),"13:30");
const book=event("2026-10-12T03:30:00Z","2026-10-12T05:00:00Z"); // Kabul 08:00 to 09:30
assert.equal(missingWeekCellKind(en(false,[book]),"09:00"),"CONTINUES",
  "09:00 is not another bookable start when an 08:00 slot still occupies the court.");
assert.equal(missingWeekCellKind(en(false,[book]),"09:30"),"UNSCHEDULED",
  "Exactly at end of a slot is not an ongoing event.");
assert.equal(missingWeekCellKind(en(false,[book]),"07:30"),"UNSCHEDULED");
assert.equal(missingWeekCellKind(en(true,[]),"09:00"),"CLOSED");
assert.equal(missingWeekCellKind(en(false,[]),"09:00"),"UNSCHEDULED");
assert.equal(formatClock12From24Hour("08:00"),"08:00 AM");
assert.equal(formatClock12From24Hour("13:30"),"01:30 PM");
assert.equal(formatClock12From24Hour("00:00"),"12:00 AM");
assert.equal(formatClock12From24Hour("12:00"),"12:00 PM");
for(const required of [
  "testID={\"owner-week-no-slot-\"+day.date+\"-\"+time}",
  "missingWeekCellKind(day,time)",
  'onPress={()=>onOpenDay(day.date)}',
  '<CompactTimeColumn value={time}/>',
  '<CompactTimeColumn value={rawTime(event.startsAt!)}/>',
  'const [clock,meridiem]=formatted.split(" ")',
  "weekTimeRail:{width:72",
  'dayTimeHeader:{',
  'dayTimeCell:{',
])assert.ok(src.includes(required),"Missing owner Week/Day cell rendering: "+required);
for(const label of ["schedule.weekSlotContinues","schedule.weekSlotNotScheduled"]){
  assert.ok(src.includes(label),"Missing status translation: "+label);
}
assert.ok(!src.includes('<View style={styles.weekEmptySlot}/>'),
  "The weekly matrix must not leave unlabeled blank cells.");
console.log("Owner weekly gaps verified: closed/ongoing/unscheduled display, reliable Kabul AM/PM and narrow pinned time rails.");
