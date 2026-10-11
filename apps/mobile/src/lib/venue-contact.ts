import type {PublicVenueDto,VenueTimelineSlotDto} from "@leaguekick/contracts";
import type {LanguageCode} from "@leaguekick/localization";

// WhatsApp requires country-code digits (no leading +); never use a private
// account phone or assume the venue's public call number supports WhatsApp.
export function contactDigits(value:string|null|undefined):string|null{
  if(!value)return null;
  const raw=value.trim().replace(/[\s().-]/g,"");
  if(!/^(?:\+|00|0|[1-9])[0-9]+$/.test(raw))return null;
  let digits=raw.startsWith("00")?raw.slice(2):raw.replace(/^\+/,"");
  if(/^0[0-9]{9}$/.test(digits))digits="93"+digits.slice(1);
  // A leading local zero is ambiguous unless it is an Afghan 10-digit number.
  if(!/^[1-9][0-9]{7,14}$/.test(digits))return null;
  return digits;
}
export function callVenueUrl(phone:string):string|null{
  const digits=contactDigits(phone);
  return digits?"tel:+"+digits:null;
}
export function reservationMessage(input:{
  venue:Pick<PublicVenueDto,"name"|"timezone">;
  language:LanguageCode;
  slot?:Pick<VenueTimelineSlotDto,"startsAt"|"endsAt"|"priceAfn">|undefined;
  alreadyBooked?:boolean;
}):string{
  const {venue,language,slot,alreadyBooked}=input;
  const locale=language==="en"?"en-GB":language;
  const when=slot?new Intl.DateTimeFormat(locale,{
    timeZone:venue.timezone,weekday:"short",day:"numeric",month:"short",year:"numeric",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  }).format(new Date(slot.startsAt)):"";
  const end=slot?new Intl.DateTimeFormat(locale,{
    timeZone:venue.timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  }).format(new Date(slot.endsAt)):"";
  if(language==="fa-AF"){
    if(alreadyBooked&&slot)return `سلام، من در «${venue.name}» برای ${when} تا ${end} رزرو دارم و می‌خواهم درباره آن صحبت کنم.`;
    return slot?`سلام، می‌خواهم برای «${venue.name}» در ${when} تا ${end} با قیمت نمایشی ${slot.priceAfn} افغانی درخواست رزرو کنم. لطفاً موجودیت این وقت و شرایط را تأیید کنید. این پیام به معنای رزرو قطعی نیست.`:
      `سلام، لطفاً درباره وقت‌های خالی و قیمت رزرو در «${venue.name}» معلومات بدهید. این پیام به معنای رزرو قطعی نیست.`;
  }
  if(language==="ps-AF"){
    if(alreadyBooked&&slot)return `سلام، ما په «${venue.name}» کې د ${when} تر ${end} پورې ریزرف کړی او غواړم په اړه یې خبرې وکړم.`;
    return slot?`سلام، غواړم په «${venue.name}» کې د ${when} تر ${end} پورې د ${slot.priceAfn} افغانیو په ښودل شوې بیه د ریزرف غوښتنه وکړم. مهرباني وکړئ وخت او شرایط تایید کړئ. دا پیغام پخپله ریزرف نه دی.`:
      `سلام، مهرباني وکړئ په «${venue.name}» کې د خالي وختونو او بیو په اړه معلومات راکړئ. دا پیغام پخپله ریزرف نه دی.`;
  }
  if(alreadyBooked&&slot)return `Hello, I already have a reservation at ${venue.name} on ${when}–${end}, and would like to discuss it with you.`;
  return slot?`Hello, I would like to request a futsal reservation at ${venue.name} on ${when}–${end} (displayed price: ${slot.priceAfn} AFN). Please confirm availability and the terms. Sending this message does not create or confirm a booking.`:
    `Hello, could you tell me the available futsal times and prices at ${venue.name}? Sending this message does not create or confirm a booking.`;
}
export function venueWhatsAppUrl(venue:PublicVenueDto,language:LanguageCode,
  slot?:VenueTimelineSlotDto,alreadyBooked=false):string|null{
  const digits=contactDigits(venue.whatsappPhone);
  if(!digits)return null;
  return "https://wa.me/"+digits+"?text="+encodeURIComponent(
    reservationMessage({venue,language,slot,alreadyBooked}));
}
