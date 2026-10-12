import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const publicGrid=read("apps/mobile/src/components/venues/VenueSlotTimetable.tsx");
const ownerGrid=read("apps/mobile/app/(app)/owner/schedule.tsx");
const check=(grid,prefix,frame,rail,scroll,clock,headerRow,slotRow)=>{
  const at=part=>grid.indexOf(part);
  const first=at('testID="'+prefix+'-week-grid"');
  const railAt=at('testID="'+prefix+'-week-sticky-times"');
  const scrollAt=at('testID="'+prefix+'-week-scrollable-days"');
  assert.ok(first>0&&railAt>first&&scrollAt>railAt,
    prefix+" time column must be outside and before horizontal date ScrollView.");
  assert.ok(grid.includes('style={[styles.'+frame),prefix+" needs full-width week frame.");
  assert.ok(grid.includes('style={styles.'+rail+'}'),prefix+" needs fixed time rail.");
  assert.ok(grid.includes('style={styles.'+scroll),prefix+" needs independent date ScrollView.");
  assert.ok(grid.includes('flexDirection:isRTL?"row-reverse":"row"')
    ||grid.includes('flexDirection:language==="en"?"row":"row-reverse"'),
    prefix+" must put time on the RTL right and LTR left.");
  const sidebar=grid.slice(railAt,scrollAt);
  assert.ok(sidebar.includes('timeRows.map(time=>')&&sidebar.includes(clock),
    prefix+" must display formatted AM/PM times for every row in the sticky rail.");
  assert.ok(sidebar.includes('weekRowHeights[time]??62'),
    prefix+" should synchronize sidebar with actual slot row heights.");
  const dates=grid.slice(scrollAt,at('</ScrollView>',scrollAt));
  assert.ok(dates.includes(headerRow)&&dates.includes(slotRow)&&
    dates.includes('onLayout={event=>measureWeekRow(time,event.nativeEvent.layout.height)}'),
    prefix+" must keep all weekday columns in one horizontal scroller and measure row heights.");
  assert.ok(grid.includes('setWeekHeaderHeight(previous=>previous===height?previous:height)'),
    prefix+" must synchronize expanded localized date header heights.");
};
check(publicGrid,"venue","weekGridFrame","weekTimeRail","weekDaysScroll",
  "formatClock12From24Hour(time)","visibleDays.map(date=>","slotsAtTime.get(date+\"|\"+time)");
check(ownerGrid,"owner","weekSlotFrame","weekTimeRail","weekSlotHorizontal",
  "<CompactTimeColumn value={time}/>","days.map((day)=>","rawTime(event.startsAt!)===time");
assert.ok(publicGrid.includes('weekDaysScroll:{flex:1,minWidth:0}')&&
  ownerGrid.includes('weekSlotHorizontal:{flex:1,minWidth:0}'),
  "Scrollable day viewport must take only the space outside the fixed time rail.");
assert.ok(publicGrid.includes('weekTimeRail:{width:WEEK_TIME_COLUMN_WIDTH')&&
  ownerGrid.includes('weekTimeRail:{width:72'),
  "Time column must have a fixed width and must never scroll sideways.");
assert.ok(ownerGrid.includes('<CompactTimeColumn value={rawTime(event.startsAt!)}/>')&&
  ownerGrid.includes('dayTimeHeader:{')&&ownerGrid.includes('dayTimeCell:{'),
  "Owner Day also needs the stacked clock and matching narrow column.");
for(const grid of [publicGrid,ownerGrid]){
  assert.ok(grid.includes('flexShrink:0'),"Time rail must not shrink or disappear on narrow phones.");
}
console.log("Sticky week times verified: time rail remains visible; seven date columns scroll together; RTL/LTR layout, AM/PM, synchronized header/row heights, and owner/public slot logic are preserved.");
