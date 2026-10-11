import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const publicGrid=read("apps/mobile/src/components/venues/VenueSlotTimetable.tsx");
const ownerGrid=read("apps/mobile/app/(app)/owner/schedule.tsx");
const formatter=read("apps/mobile/src/lib/slot-display.ts");
const tile=read("apps/mobile/src/components/ui/SlotTileContent.tsx");

for(const marker of [
  'const Slot=memo(function Slot',
  'const tap=useCallback(',
  'requestAnimationFrame(()=>onTap(item,date))',
  'setProcessing(true)',
  'setTimeout(()=>setProcessing(false),1200)',
  '<ActivityIndicator size="small"',
  'accessibilityState={{disabled,busy:processing}}',
  'disabled={disabled||processing} onPress={press}',
  'onTap:(slot:VenueTimelineSlotDto,date:string)=>void',
  'const ownBySlot=useMemo(',
  'const ownBooking=useCallback(',
  'const {timeRows,slotsAtTime}=useMemo(',
  'slotsAtTime.get(date+"|"+time)',
  'clockFormatters.get(timeZone)',
  'setSelected({date,slot,fresh:days[date]?.fresh===true})',
]){
  assert.ok(publicGrid.includes(marker),"Interactive slot response invariant missing: "+marker);
}
assert.ok(publicGrid.indexOf('const Slot=memo(function Slot')<
  publicGrid.indexOf('export function VenueSlotTimetable('),
  "Slots must be defined outside the parent, not remounted when selected changes.");
const tap=publicGrid.slice(publicGrid.indexOf('const tap=useCallback('),
  publicGrid.indexOf('  function book()',publicGrid.indexOf('const tap=useCallback(')));
assert.ok(tap.includes('if(!bookable&&!mine)return'),
  "Occupied, non-user slots must remain disabled.");
assert.ok(!tap.includes('await ')&&!tap.includes('bookingApi.mine')&&!tap.includes('venueApi.availability'),
  "Opening a tile must be immediate and never await a remote request.");
assert.ok(publicGrid.includes('selected.fresh&&connected'),
  "Booking must still require fresh online inventory.");
assert.ok(publicGrid.includes('bookingApi.cancel(session.accessToken,own.id)'),
  "Cancellation must remain server authorized.");
for(const marker of [
  'const MemoWeekView=memo(WeekView)',
  'const MemoDaySlotView=memo(DaySlotView)',
  '<MemoWeekView',
  '<MemoDaySlotView',
  'const onSelectSlot=useCallback(',
  'onSelectSlot={onSelectSlot}',
  'onTodayRowLayout={onTodayRowLayout}',
]){
  assert.ok(ownerGrid.includes(marker),"Owner slot dialog responsiveness invariant missing: "+marker);
}
assert.ok(formatter.includes('formatterCache.get(timeZone)')&&
  formatter.includes('formatterCache.set(timeZone,formatter)'),
  "Shared time labels must reuse Intl formatters across numerous slots.");
assert.ok(tile.includes('useMemo(()=>formatSlotStartTime(startsAt,timeZone)'),
  "Tile text must not reformat until the start/venue timezone changes.");
console.log("Fast slot interactions verified: stable memoized tiles, indexed weekly slots, instant paint feedback, no on-tap networking, owner grid isolation and booking authorization.");
