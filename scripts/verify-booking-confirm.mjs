import assert from "node:assert/strict";
import fs from "node:fs";
import {formatBookingSlot,formatBookingPrice}
  from "../apps/mobile/src/lib/booking-confirm-display.ts";

const input="2026-10-12T04:30:00.000Z";
const en=formatBookingSlot(input,"en","Asia/Kabul");
assert.ok(en,"Valid slot must be format-able.");
assert.equal(en?.date,"12 Oct 2026");
assert.equal(en?.day,"Monday");
assert.equal(en?.time,"09:00 AM");
assert.equal(en?.dayKey,"2026-10-12");
assert.ok(!en?.date.includes("T04:30:00"),"Never show a raw UTC ISO string.");
assert.ok(!en?.time.includes("GMT"),"Never show timezone offsets or seconds.");
const nY=formatBookingSlot(input,"en","America/New_York");
assert.equal(nY?.day,"Monday");
assert.equal(nY?.time,"12:30 AM");
assert.equal(formatBookingSlot(input,"en","Invalid/NotAZone")?.time,"09:00 AM");
assert.equal(formatBookingSlot(input,"en","")?.time,"09:00 AM");
assert.equal(formatBookingSlot(null,"en"),null);
assert.equal(formatBookingSlot("not-a-time","fa-AF"),null);
const late=formatBookingSlot("2026-10-12T17:00:00Z","en");
const tomorrow=formatBookingSlot("2026-10-12T19:30:00Z","en");
assert.equal(late?.dayKey,"2026-10-12");
assert.equal(tomorrow?.dayKey,"2026-10-13");
assert.equal(late?.time,"09:30 PM");
assert.equal(tomorrow?.time,"12:00 AM");
for(const language of ["en","fa-AF","ps-AF"]){
  const parts=formatBookingSlot(input,language,"Asia/Kabul");
  assert.ok(parts?.day && parts?.date && parts?.time,"Missing localized field: "+language);
  assert.ok(!/GMT|UTC|T04:30/.test(parts.date+" "+parts.day+" "+parts.time));
  assert.ok(formatBookingPrice("500",language)?.endsWith(" AFN"));
}
assert.equal(formatBookingPrice("500","en"),"500 AFN");
assert.equal(formatBookingPrice("-15","en"),null);
assert.equal(formatBookingPrice("bad","en"),null);
assert.equal(formatBookingPrice("","en"),null);

const screen=fs.readFileSync(new URL("../apps/mobile/app/(app)/booking/confirm.tsx",import.meta.url),"utf8");
const translations=fs.readFileSync(new URL("../packages/localization/src/index.ts",import.meta.url),"utf8");
for(const marker of [
  "formatBookingSlot(params.startsAt,language,params.timeZone)",
  "formatBookingSlot(params.endsAt,language,params.timeZone)",
  "formatBookingPrice(params.priceAfn,language)",
  "start.dayKey===end.dayKey",
  "start.date",
  "start.day",
  "timeRange",
  "booking.serverRecheck",
  "bookingApi.create(session.accessToken",
  "idempotencyKey:key.current",
  "accessibilityState={{disabled:!canConfirm,busy}}",
  'testID="booking-confirm-summary"',
  'testID="booking-confirm-button"',
  'note:note.trim()',
  "maxLength={500}",
  "router.replace(\"/bookings\")",
]){
  assert.ok(screen.includes(marker),"Booking UI/security invariant missing: "+marker);
}
assert.ok(!screen.includes("{params.startsAt}"),"Booking confirmation must not render ISO time.");
for(const key of ["booking.summaryIntro","booking.venueLabel","booking.dayLabel",
  "booking.timeLabel","booking.priceLabel","booking.detailsUnavailable"]){
  assert.equal(translations.split('"'+key+'"').length-1,3,
    "Missing English/Dari/Pashto translation: "+key);
}
console.log("Booking confirmation verified: localized date, weekday, 12h AM/PM time, timezone fallback, no raw ISO, price, guardrails and RTL labels.");
