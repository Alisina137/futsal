import assert from "node:assert/strict";
import fs from "node:fs";
import {contactDigits,callVenueUrl,reservationMessage,venueWhatsAppUrl}
  from "../apps/mobile/src/lib/venue-contact.ts";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const grid=read("apps/mobile/src/components/venues/VenueSlotTimetable.tsx");
const types=read("apps/api/src/modules/booking/booking.types.ts");
const repository=read("apps/api/src/modules/booking/booking.repository.ts");
const publicDto=read("packages/contracts/src/index.ts");
const i18n=read("packages/localization/src/index.ts");
assert.equal(contactDigits("070 123 4567"),"93701234567");
assert.equal(contactDigits("+93 (70) 123-4567"),"93701234567");
assert.equal(contactDigits("0093 70 123 4567"),"93701234567");
assert.equal(contactDigits("+1 650 555 0100"),"16505550100");
for(const input of ["","garbage","0","0712","000111","http://example.com"]){
  assert.equal(contactDigits(input),null,"invalid phone must not form URL");
}
assert.equal(callVenueUrl("070 123 4567"),"tel:+93701234567");
const venue={id:"1",name:"Test Court",timezone:"Asia/Kabul",publicPhone:"0701234567",
  whatsappPhone:null};
const slot={startsAt:"2026-10-14T10:00:00.000Z",endsAt:"2026-10-14T11:30:00.000Z",priceAfn:700};
assert.equal(venueWhatsAppUrl(venue,"en"),null,"Public call number is not owner WhatsApp opt-in.");
const wa=venueWhatsAppUrl({...venue,whatsappPhone:"0701234567"},"en",slot);
assert.ok(wa?.startsWith("https://wa.me/93701234567?text="));
assert.match(decodeURIComponent(wa??""),/Test Court/);
assert.match(decodeURIComponent(wa??""),/not create or confirm a booking/);
for(const language of ["en","fa-AF","ps-AF"]){
  assert.ok(reservationMessage({venue,language,slot}).length>40);
  assert.ok(reservationMessage({venue,language,slot,alreadyBooked:true}).length>20);
}
for(const part of ['bookingApi.mine(session.accessToken)', 'item.playerUserId===session.user.id',
  'item.source==="ONLINE"','item.status!=="CANCELLED"','bookingApi.cancel(session.accessToken,own.id)',
  'disabled={disabled||processing} onPress={press}', 'requestAnimationFrame(()=>onTap(item,date))',
  'const Slot=memo(function Slot', 'slotsAtTime.get(date+"|"+time)','if(!bookable&&!mine)return',
  '<Modal transparent visible={!!selected}', 'setCancelConfirm(true)','cancelBusy',
  'venueWhatsAppUrl(venue,language,selected.slot,!!selectedOwn)',
  'selected.fresh&&connected','router.push({pathname:"/booking/confirm"',
  'readAvailabilityCache', 'writeAvailabilityCache']){
  assert.ok(grid.includes(part),"Required reserve interaction missing: "+part);
}
assert.ok(publicDto.includes('whatsappPhone: z.string().nullable().optional()'));
assert.ok(types.includes('whatsappPhone: venue.whatsappPhone ?? null'));
assert.ok(repository.includes('whatsappPhone: row.whatsappPhone'));
for(const key of ["contactTitle","whatsapp","whatsappUnavailable","contactDisclaimer",
  "yourBooking","myPending","myConfirmed","cancelConfirm","cancelFailed"]){
  assert.equal(i18n.split('"vd.grid.'+key+'"').length-1,3,
    "Missing English/Dari/Pashto translation: "+key);
}
console.log("Venue reserve actions verified: visible dialogs, own-only booking management, disabled unavailable slots, opt-in WhatsApp and guarded phone links.");
