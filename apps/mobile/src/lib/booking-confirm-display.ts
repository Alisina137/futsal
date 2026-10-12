import type {LanguageCode} from "@leaguekick/localization";
// Keep this pure formatter directly executable in Node 24 regression tests.
const AFGHANISTAN_TIME_ZONE = "Asia/Kabul";

const locales:Record<LanguageCode,string>={
  en:"en-GB","fa-AF":"fa-AF","ps-AF":"ps-AF",
};
export type BookingSlotDisplay={
  date:string;
  day:string;
  time:string;
  dayKey:string;
};

/**
 * A reservation should never show UTC ISO text or a GMT offset. The venue's
 * timezone is authoritative; invalid/missing zones use Afghanistan local time.
 * The date, weekday and 24-hour time are separate so both RTL and LTR
 * layouts can label them clearly.
 */
export function formatBookingSlot(
  value:string|Date|null|undefined,
  language:LanguageCode,
  venueTimeZone:string=AFGHANISTAN_TIME_ZONE,
):BookingSlotDisplay|null{
  if(!value)return null;
  const instant=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(instant.getTime()))return null;
  let timeZone=venueTimeZone||AFGHANISTAN_TIME_ZONE;
  try{
    // An invalid supplied IANA zone must not crash the confirmation page.
    new Intl.DateTimeFormat("en-GB",{timeZone}).format(instant);
  }catch{
    timeZone=AFGHANISTAN_TIME_ZONE;
  }
  const locale=locales[language];
  const common={timeZone,calendar:"gregory"} as const;
  const date=new Intl.DateTimeFormat(locale,{
    ...common,year:"numeric",month:"short",day:"numeric",
  }).format(instant);
  const day=new Intl.DateTimeFormat(locale,{
    ...common,weekday:"long",
  }).format(instant);
  const time=new Intl.DateTimeFormat(locale,{
    ...common,hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  }).format(instant);
  const parts=new Intl.DateTimeFormat("en-GB",{
    ...common,year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(instant);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value??"";
  return {date,day,time,dayKey:`${get("year")}-${get("month")}-${get("day")}`};
}

export function formatBookingPrice(raw:string|undefined,language:LanguageCode):string|null{
  if(!raw||!/^\d+(?:\.\d{1,2})?$/.test(raw.trim()))return null;
  const value=Number(raw);
  if(!Number.isFinite(value)||value<0||value>1_000_000)return null;
  const number=new Intl.NumberFormat(locales[language],{
    minimumFractionDigits:0,maximumFractionDigits:2,
  }).format(value);
  return number+" AFN";
}
