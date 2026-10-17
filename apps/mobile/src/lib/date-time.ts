import type { LanguageCode } from "@leaguekick/localization";
import {refereeKabulDay,refereeWeekStart,refereeShiftDay} from "./referee-calendar";

const localeByLanguage: Record<LanguageCode, string> = {
  "fa-AF": "fa-AF",
  "ps-AF": "ps-AF",
  en: "en-GB",
};

export const AFGHANISTAN_TIME_ZONE = "Asia/Kabul";

export function formatLocalDateTime(
  value: string | Date,
  language: LanguageCode,
  timeZone: string = AFGHANISTAN_TIME_ZONE,
) {
  const parts=formatLocalDateTimeParts(value,language,timeZone);
  return parts.time?parts.date+" · "+parts.time:parts.date;
}

/** Public competition About: date and AM/PM time; no seconds or offset. */
export function formatCompetitionDateTime(value:string|Date,language:LanguageCode):string{
  return formatLocalDateTime(value,language);
}

/** Timezone-correct date and explicit 12-hour English AM/PM clock. */
function clock(value:Date,timeZone:string):string{
  let zone=timeZone||AFGHANISTAN_TIME_ZONE;
  try{
    return new Intl.DateTimeFormat("en-US",{
      timeZone:zone,hour:"2-digit",minute:"2-digit",hour12:true,
    }).format(value).replace(/[\u00a0\u202f]/g," ");
  }catch{
    zone=AFGHANISTAN_TIME_ZONE;
    return new Intl.DateTimeFormat("en-US",{
      timeZone:zone,hour:"2-digit",minute:"2-digit",hour12:true,
    }).format(value).replace(/[\u00a0\u202f]/g," ");
  }
}

/** A single calendar policy for the Referee Dashboard and appointment cards.
 * Dari/Pashto display Solar Hijri when the device supports it. If Hermes/ICU
 * cannot provide that calendar, all labels consistently fall back to Gregorian.
 */
function refereeDateFormatter(language:LanguageCode,options:Intl.DateTimeFormatOptions){
  const solar=language!=="en";
  const calendar=solar?"persian":"gregory";
  const locale=localeByLanguage[language];
  try{
    const format=new Intl.DateTimeFormat(locale,{
      timeZone:AFGHANISTAN_TIME_ZONE,calendar,...options,
    });
    if(format.resolvedOptions().calendar===calendar)return format;
  }catch{}
  return new Intl.DateTimeFormat("en-GB",{
    timeZone:AFGHANISTAN_TIME_ZONE,calendar:"gregory",...options,
  });
}

/** Separate calendar date and AM/PM clock in Kabul time, for all three languages. */
export function formatRefereeScheduleParts(value:string|Date,language:LanguageCode){
  const date=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(date.getTime()))return {date:String(value),time:""};
  return {
    date:refereeDateFormatter(language,{
      weekday:"short",year:"numeric",month:"long",day:"numeric",
    }).format(date),
    time:clock(date,AFGHANISTAN_TIME_ZONE),
  };
}
/** Selected period is a Kabul-local Day, Saturday/Monday week, or Solar/Gregorian month. */
export function formatRefereeCalendarPeriod(
  value:Date,mode:"day"|"week"|"month",language:LanguageCode,
){
  const cursor=refereeKabulDay(value);
  if(!cursor)return "";
  const displayDay=(day:string)=>
    new Date(day+"T12:00:00Z");
  if(mode==="day")return refereeDateFormatter(language,{
    weekday:"long",day:"numeric",month:"long",year:"numeric",
  }).format(displayDay(cursor));
  if(mode==="month")return refereeDateFormatter(language,{
    month:"long",year:"numeric",
  }).format(displayDay(cursor));
  const first=refereeWeekStart(cursor,language);
  const last=refereeShiftDay(first,6);
  const formatter=refereeDateFormatter(language,{
    day:"numeric",month:"short",year:"numeric",
  });
  return formatter.format(displayDay(first))+" – "+formatter.format(displayDay(last));
}

export function formatLocalDateTimeParts(
  value: string | Date,
  language: LanguageCode,
  timeZone: string = AFGHANISTAN_TIME_ZONE,
) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()))return {date:String(value),time:""};
  let zone=timeZone||AFGHANISTAN_TIME_ZONE;
  try{new Intl.DateTimeFormat("en-US",{timeZone:zone}).format(date);}
  catch{zone=AFGHANISTAN_TIME_ZONE;}
  return {
    date:new Intl.DateTimeFormat(localeByLanguage[language],{
      calendar:"gregory",timeZone:zone,
      year:"numeric",month:"short",day:"numeric",
    }).format(date),
    time:clock(date,zone),
  };
}


/**
 * Relative publication times without Intl.RelativeTimeFormat.
 *
 * Android Hermes/Expo Go may not provide this constructor, even when
 * Intl.DateTimeFormat is available. Keep this function safe on those devices
 * and use app-language-specific units (including Dari/Pashto numerals).
 */
type RelativeUnit="minute"|"hour"|"day"|"week"|"month"|"year";

const postTimeUnits:Record<LanguageCode,Record<RelativeUnit,string>>={
  en:{minute:"minute",hour:"hour",day:"day",week:"week",month:"month",year:"year"},
  "fa-AF":{minute:"دقیقه",hour:"ساعت",day:"روز",week:"هفته",month:"ماه",year:"سال"},
  "ps-AF":{minute:"دقیقه",hour:"ساعت",day:"ورځ",week:"اونۍ",month:"میاشت",year:"کال"},
};

function localizedDuration(value:number,unit:RelativeUnit,language:LanguageCode):string{
  if(language==="en"){
    const unitName=postTimeUnits.en[unit];
    return `${value} ${unitName}${value===1?"":"s"} ago`;
  }
  // Avoid reliance on Intl.NumberFormat for lightweight Hermes builds as well.
  const nativeDigits="۰۱۲۳۴۵۶۷۸۹";
  const count=String(value).replace(/[0-9]/g,digit=>nativeDigits[Number(digit)]!);
  const word=postTimeUnits[language][unit];
  const psPlural:Partial<Record<RelativeUnit,string>>={
    day:"ورځې",week:"اونۍ",month:"میاشتې",year:"کاله",hour:"ساعته",minute:"دقیقې",
  };
  return language==="ps-AF"
    ? `${count} ${value===1?word:psPlural[unit]??word} مخکې`
    : `${count} ${word} پیش`;
}

export function formatPostTimeAgo(
  publishedAt:string|Date,
  language:LanguageCode,
  nowMs:number=Date.now(),
):string{
  const published=publishedAt instanceof Date?publishedAt:new Date(publishedAt);
  const value=published.getTime();
  if(!Number.isFinite(value))return String(publishedAt);
  const seconds=Math.max(0,Math.floor((nowMs-value)/1000));
  if(seconds<60)return language==="fa-AF"?"همین حالا":language==="ps-AF"?"همدا اوس":"now";
  if(seconds<3600)return localizedDuration(Math.floor(seconds/60),"minute",language);
  if(seconds<86400)return localizedDuration(Math.floor(seconds/3600),"hour",language);
  if(seconds<604800)return localizedDuration(Math.floor(seconds/86400),"day",language);
  if(seconds<2592000)return localizedDuration(Math.floor(seconds/604800),"week",language);
  if(seconds<31536000)return localizedDuration(Math.floor(seconds/2592000),"month",language);
  return localizedDuration(Math.floor(seconds/31536000),"year",language);
}
