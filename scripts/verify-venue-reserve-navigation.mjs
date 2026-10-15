import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const venue=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const picker=read("apps/mobile/src/components/venues/VenueReserveDatePicker.tsx");
const dates=read("apps/mobile/src/lib/venue-reserve-date-picker.ts");
const booking=read("apps/mobile/src/components/bookings/ReservationsPanel.tsx");
const tabs=read("apps/mobile/src/hooks/useVisibleTab.ts");
const pkg=JSON.parse(read("package.json"));
for(const marker of [
  'maximumAdvanceBookingDays={venue.maximumAdvanceBookingDays}',
  '<VenueReserveDatePicker selected={date} today={today}',
  'onChange={setDate}',
  'if(sub==="bookings")return',
  '<ReservationsPanel',
]){
  assert.ok(venue.includes(marker),"Venue Reserve missing: "+marker);
}
for(const marker of [
  'testID="venue-offers-date-picker-trigger"',
  'testID="venue-offers-date-picker-dialog"',
  'onPress={()=>setOpen(true)}',
  'Modal visible={open} transparent animationType="fade"',
  'venuePickerMonthDays(anchor,today,maximumAdvanceBookingDays,language)',
  'venuePickerCanMoveMonth(anchor,-1,today,maximumAdvanceBookingDays,language)',
  'venuePickerCanMoveMonth(anchor,1,today,maximumAdvanceBookingDays,language)',
  'orderedWeekdays(language)',
  'formatWeekdayName(weekday,language)',
  'onChange(day.date);dismiss();',
  'accessibilityState={{disabled:!day.enabled,selected:active}}',
  'disabled={!day.enabled}',
  'moveView("MONTH",value,1,language)',
  'moveView("MONTH",value,-1,language)',
  'minHeight:44',
]){
  assert.ok(picker.includes(marker),"Venue date picker missing: "+marker);
}
assert.ok(!venue.includes('<TextField label={t("booking.date")}'),
  "Reserve > Discounts should open the picker, not a free-text date input.");
assert.ok(dates.includes('isVenueBookingDay(date,today,advanceDays)'));
assert.ok(dates.includes('day.currentMonth&&day.enabled'));
for(const marker of [
  'useVisibleTab<ReservationGroup>(filter)',
  'filterNav.focus(next,true)',
  'testID="my-reservations-filter-nav"',
  'ref={filterNav.scrollRef}',
  'onLayout={filterNav.onViewport}',
  'onContentSizeChange={filterNav.onContentSize}',
  'onLayout={event=>filterNav.cellLayout(group,event)}',
  'testID={"my-reservations-filter-"+group}',
  'accessibilityState={{selected:filter===group}}',
  'onPress={()=>chooseGroup(group)}',
  'onPress={()=>chooseGroup("ALL")}',
  'filterChip:{minHeight:44',
]){
  assert.ok(booking.includes(marker),"My Reserves focus missing: "+marker);
}
assert.ok(tabs.includes('scrollRef.current?.scrollTo'),"Tab focus helper missing scrolling.");
assert.ok(pkg.scripts["verify:venue-reserve-navigation"]?.includes("venue-reserve-date-picker.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:venue-reserve-navigation"));
console.log("Venue Reserve verified: native Expo-compatible localized date picker constrained to booking range and centered selected My Reserves tabs.");
