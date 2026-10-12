import assert from "node:assert/strict";
import fs from "node:fs";
import {findOwnBookingForSlot,ownActiveVenueBookings} from "../apps/mobile/src/lib/own-slot-bookings.ts";
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
for(const part of ['bookingApi.mine(session.accessToken)',
  'ownActiveVenueBookings(result.bookings,venue.id,session.user.id)',
  'findOwnBookingForSlot(ownBookingsByArea.get(slot.areaId)??[],slot)','bookingApi.cancel(session.accessToken,own.id)',
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

const mk=(id,source,extra={})=>({id,source,venueId:"v",playerUserId:"me",
  areaId:"court",status:"CONFIRMED",startsAt:"2026-10-17T16:00:00Z",
  endsAt:"2026-10-17T17:30:00Z",...extra});
const online=mk("online","ONLINE");
const manual=mk("manual","MANUAL",{startsAt:"2026-10-18T16:00:00Z",endsAt:"2026-10-18T17:30:00Z"});
const mine=ownActiveVenueBookings([online,manual,mk("other","ONLINE",{playerUserId:"someone"}),
  mk("different","ONLINE",{venueId:"not-v"}),mk("cancelled","ONLINE",{status:"CANCELLED"})],"v","me");
assert.deepEqual(mine.map(x=>x.id),["online","manual"]);
assert.equal(findOwnBookingForSlot(mine,{areaId:"court",startsAt:online.startsAt,endsAt:online.endsAt})?.id,"online");
assert.equal(findOwnBookingForSlot(mine,{areaId:"court",startsAt:"2026-10-18T16:30:00Z",
  endsAt:"2026-10-18T17:00:00Z"})?.id,"manual");
assert.equal(findOwnBookingForSlot(mine,{areaId:"different",startsAt:online.startsAt,endsAt:online.endsAt}),undefined);
assert.equal(findOwnBookingForSlot(mine,{areaId:"court",startsAt:"2026-10-19T16:00:00Z",
  endsAt:"2026-10-19T17:30:00Z"}),undefined);
assert.equal(findOwnBookingForSlot([mk("cancelled","ONLINE",{status:"CANCELLED"})],
  {areaId:"court",startsAt:online.startsAt,endsAt:online.endsAt}),undefined);
for(const x of ["timeHeading:{width:WEEK_TIME_COLUMN_WIDTH",
  "timeCell:{width:WEEK_TIME_COLUMN_WIDTH","dayHeading:{width:WEEK_DAY_COLUMN_WIDTH",
  "weekCell:{width:WEEK_DAY_COLUMN_WIDTH",'useFocusEffect(useCallback(',
  '<Button label={tr("cancelReservation")} variant="danger"',
  '<ScrollView style={styles.modalPanel} contentContainerStyle={styles.modalContent}']){
  assert.ok(grid.includes(x),"Own reservation UI or column alignment missing: "+x);
}
assert.ok(!grid.includes('item.source==="ONLINE"'),"Linked manual bookings must be cancellable.");
const cache=read("apps/mobile/src/lib/api-cache.ts");
assert.ok(cache.includes('if (pathname === "/api/v1/bookings/me") return null;'));
assert.ok(!cache.includes('pathname === "/api/v1/bookings/me") return { ttlMs:'));

console.log("Venue reserve actions verified: visible dialogs, own-only booking management, disabled unavailable slots, opt-in WhatsApp and guarded phone links.");
