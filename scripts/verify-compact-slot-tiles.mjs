import assert from "node:assert/strict";
import fs from "node:fs";
import {formatSlotStartTime,formatSlotTilePrice} from "../apps/mobile/src/lib/slot-display.ts";
import {softenSlotColor,SLOT_BACKGROUND_SOFTENING} from "../apps/mobile/src/lib/slot-color.ts";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const tile=read("apps/mobile/src/components/ui/SlotTileContent.tsx");
const publicGrid=read("apps/mobile/src/components/venues/VenueSlotTimetable.tsx");
const ownerGrid=read("apps/mobile/app/(app)/owner/schedule.tsx");
const offerGrid=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const ownerCheck=read("scripts/verify-venue-timetable.mjs");
const publicCheck=read("scripts/verify-venue-slot-grid.mjs");

// Explicit examples: Kabul local 06:00, 13:30 and noon, independent of
// the device's time zone or whether the user selected RTL language.
assert.equal(formatSlotStartTime("2026-10-12T01:30:00.000Z","Asia/Kabul"),"6:00 AM");
assert.equal(formatSlotStartTime("2026-10-12T09:00:00.000Z","Asia/Kabul"),"1:30 PM");
assert.equal(formatSlotStartTime("2026-10-12T07:30:00.000Z","Asia/Kabul"),"12:00 PM");
assert.equal(formatSlotStartTime("2026-10-11T19:30:00.000Z","Asia/Kabul"),"12:00 AM");
assert.equal(formatSlotStartTime("2026-10-12T01:30:00.000Z","UTC"),"1:30 AM");
assert.equal(formatSlotStartTime("not-a-date","Asia/Kabul"),"—");
assert.equal(formatSlotTilePrice(500),"500 AF");
assert.equal(formatSlotTilePrice(0),"0 AF");
assert.equal(formatSlotTilePrice(null),"—");
assert.equal(formatSlotTilePrice(undefined),"—");
assert.equal(SLOT_BACKGROUND_SOFTENING,0.15);
assert.equal(softenSlotColor("#000000"),"#262626");
assert.equal(softenSlotColor("#FFFFFF"),"#FFFFFF");
assert.equal(softenSlotColor("#166534"),"#397C52");
assert.equal(softenSlotColor("#DCFCE7"),"#E1FCEB");
assert.equal(softenSlotColor("#7E22CE"),"#9143D5");
assert.equal(softenSlotColor("transparent"),"transparent");

// The tile is pure display: owners keep their management actions and
// customers keep existing ownership, offline and reservation protections.
for(const fragment of [
 'formatSlotStartTime(startsAt,timeZone)',
 'formatSlotTilePrice(priceAfn)',
 'styles.header','styles.diagonal','styles.price','styles.marker',
 'textAlign:"left"','textAlign:"right"',
 'alignSelf:"flex-start"','alignSelf:"flex-end"',
 'borderLeftWidth:frame.width','borderBottomWidth:frame.height',
 'borderBottomColor:softenSlotColor(ink)','borderLeftColor:"transparent"',
 'position:"absolute",top:0,left:0','overflow:"hidden"',
 'position:"absolute",top:2,right:2',
 'onLayout={onTileLayout}','pointerEvents="none"',
 'forceLtr','numberOfLines={1}',
]){
  assert.ok(tile.includes(fragment),"Missing shared slot face invariant: "+fragment);
}
assert.equal(publicGrid.split("<SlotTileContent").length-1,1,
  "The same compact face must render both public Day and Week via Slot().");
assert.equal(ownerGrid.split("<SlotTileContent").length-1,2,
  "Owner Week and Day must use the same compact slot face.");
assert.equal(offerGrid.split("<SlotTileContent").length-1,1,
  "Promotion time slots must use the same compact slot face.");
for(const required of [
  'disabled={disabled||processing} onPress={press}',
  'requestAnimationFrame(()=>onTap(item,date))',
  'const Slot=memo(function Slot',
  'slotsAtTime.get(date+"|"+time)',
]){
  assert.ok(publicGrid.includes(required),"Missing responsive slot interaction: "+required);
}
assert.ok(publicGrid.includes('setSelected({date,slot'));
assert.ok(publicGrid.includes('statusColors'));
assert.ok(ownerGrid.includes("onSelectSlot(event,day.date)"));
assert.ok(ownerGrid.includes("SlotCornerMarker"));
assert.ok(ownerGrid.includes("slotPalette[event.type]"));
assert.ok(ownerCheck.includes("weekSlotGrid")&&publicCheck.includes("statusColors"));
assert.ok(!tile.includes("AFN"),"Compact tiles show AF; full booking details retain AFN.");
assert.ok(tile.includes('time:{fontSize:12,lineHeight:17')&&
  tile.includes('price:{fontSize:12,lineHeight:17,color:"#FFFFFF"')&&
  tile.includes('<AppText variant="caption" weight="bold" forceLtr'),
  "Slot start and price must have the same font size and weight.");
assert.ok(tile.includes('borderBottomColor:softenSlotColor(ink),')&&
  tile.includes('borderLeftColor:"transparent"'),
  "Slot time side stays pale with dark text; lower diagonal side must use solid status color with white price.");
assert.ok(!tile.includes("styles.rule")&&!tile.includes('rule:{height:1'),
  "Divider must be diagonal like the reference, not a horizontal line.");
assert.ok(tile.includes("previous.width===w&&previous.height===h"),
  "Responsive slot divider must not trigger an infinite onLayout redraw loop.");
assert.ok(tile.includes('gap:3,overflow:"hidden",borderRadius:radiusSlotInset'),
  "The diagonal itself must be clipped to its interior tile.");
assert.ok(publicGrid.includes('styles.slot,{backgroundColor:softenSlotColor(palette.bg)')&&
  publicGrid.includes('paddingHorizontal:2,position:"relative",overflow:"hidden"'),
  "Reserve slots must have softened time colors and clip at rounded borders.");
assert.ok(ownerGrid.includes('backgroundColor:softenSlotColor(palette.background)')&&
  ownerGrid.split("  weekSlot:{")[1]?.split("  slotCornerMarker:")[0]?.includes('overflow:"hidden"')&&
  ownerGrid.split("  daySlotButton:{")[1]?.split("  dayClosedSlot:")[0]?.includes('overflow:"hidden"'),
  "Owner Week/Day slots must soften time background and clip rounded corners.");
assert.ok(offerGrid.includes('backgroundColor:softenSlotColor("#F3E8FF")')&&
  offerGrid.includes('borderRadius:radius.md,overflow:"hidden"'),
  "Offer slots must use the same softening and edge clipping.");
assert.ok(tile.includes('color:"#FFFFFF"'),
  "Text in dark diagonal price area must remain white after reducing color by 15%.");
console.log("Compact slot tiles verified: 12-hour start and AF price on opposite corners, responsive diagonal two-tone separator, owner/customer/offers reuse, and booking guards.");
